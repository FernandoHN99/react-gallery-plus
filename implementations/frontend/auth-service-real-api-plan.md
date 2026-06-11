# Plano: auth-service.ts — integração real com a API

## Contexto

O `auth-service.ts` atual usa `localStorage` e dados mock. O backend já possui
`POST /auth/login` (token 10m + cookie `refreshToken` httpOnly 7d).

A nova estratégia de segurança:

| O quê | Onde fica |
|---|---|
| `refreshToken` | Cookie `httpOnly` — setado/limpado pelo backend, invisível ao JS |
| `token` de acesso (JWT 10m) | Variável em memória no módulo `auth-service.ts` |
| Dados do usuário | Cache TanStack Query `['session']` |

O token em memória some ao recarregar a página (intencional). Por isso
`getSession` precisa chamar `POST /auth/refresh` para renovar via cookie.

---

## Novas rotas necessárias no backend

Antes de implementar o frontend, o backend precisa de 3 rotas adicionais em
`server/auth/auth-routes.ts`:

### `POST /auth/refresh`

- Lê o `refreshToken` do cookie (httpOnly, enviado automaticamente)
- Verifica o JWT com `request.jwtVerify({ onlyCookie: false })`
- Busca o user pelo `sub` do payload no `db.json`
- Se válido: gera novo `token` (10m) e retorna `{ token }`
- Se inválido/expirado: 401

```
POST /auth/refresh
  Cookie: refreshToken=<jwt>
  ← { token: "..." }   ou   401
```

### `POST /auth/logout`

- Limpa o cookie `refreshToken` via `reply.clearCookie('refreshToken', { path: '/' })`
- Retorna 204

```
POST /auth/logout
  ← 204
```

### `GET /auth/me`

- Protegido por `verifyJwt` (preHandler)
- Lê `request.user.sub` do payload JWT (header `Authorization: Bearer <token>`)
- Busca o user pelo id no `db.json`
- Retorna `{ id, email }` (sem `passwordHash`)
- Se não encontrado: 404

```
GET /auth/me
  Authorization: Bearer <token>
  ← { id: "1", email: "admin@gallery.com" }
```

> O modelo `User` do frontend tem `{ id, name, email }`. O backend não armazena
> `name` ainda — retornar `name: ""` ou omitir. Ajustar modelo frontend se necessário.

---

## Frontend: `src/contexts/auth/services/auth-service.ts`

### Variável de token em memória

```ts
let accessToken: string | null = null
```

Módulo-level. Persiste enquanto a aba estiver aberta. Some ao recarregar ou
fechar — renovado automaticamente via `getSession` → `POST /auth/refresh`.

### `login(email, password): Promise<User>`

1. `POST /auth/login` com `{ email, password }`
2. Armazena `data.token` em `accessToken`
3. Chama `GET /auth/me` com `Authorization: Bearer <token>` para obter o `User`
4. Retorna o `User`

```ts
async login(email: string, password: string): Promise<User> {
  const { data } = await api.post<{ token: string }>('/auth/login', { email, password })
  accessToken = data.token
  return fetchMe()
}
```

### `getSession(): Promise<User>`

Chamado pelo `useQuery` de `use-session.ts` ao montar e a cada 1h.

1. Se `accessToken` existir em memória → chama `GET /auth/me` diretamente
2. Se não existir (reload da página, token expirado):
   - `POST /auth/refresh` — envia cookie automaticamente (withCredentials já ativo no `api`)
   - Armazena novo `token` em `accessToken`
   - Chama `GET /auth/me`
3. Se refresh retornar 401 → lança erro → `useSession.isAuthenticated = false` → redirect `/login`

```ts
async getSession(): Promise<User> {
  if (!accessToken) {
    const { data } = await api.post<{ token: string }>('/auth/refresh')
    accessToken = data.token
  }
  return fetchMe()
}
```

### `logout(): Promise<void>`

1. Limpa `accessToken = null`
2. `POST /auth/logout` — backend limpa o cookie `refreshToken`

```ts
async logout(): Promise<void> {
  accessToken = null
  await api.post('/auth/logout')
}
```

### Helper interno `fetchMe()`

Reutilizado por `login` e `getSession`. Chama `GET /auth/me` injetando o token
no header (não usa o interceptor global pois o token está em memória, não no cookie).

```ts
async function fetchMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return data
}
```

---

## Fluxo completo após implementação

```
App carrega (reload)
  └─> useSession: isPending=true → spinner
        └─> getSession()
              └─> accessToken = null → POST /auth/refresh (envia cookie)
                    ├─ cookie válido → novo token → GET /auth/me → User
                    │    └─> isAuthenticated=true → renderiza app
                    └─ cookie expirado/ausente → 401 → lança erro
                          └─> isAuthenticated=false → redirect /login

Login
  └─> POST /auth/login → { token } + cookie refreshToken
        └─> accessToken = token → GET /auth/me → User
              └─> setQueryData(['session'], user) → isAuthenticated=true → redirect

Token expira (10min) + useQuery refetch (1h)
  └─> GET /auth/me → 401
        └─> getSession() → POST /auth/refresh → novo token → GET /auth/me
              (o interceptor de 401 pode automatizar isso — ver nota abaixo)

Logout
  └─> accessToken = null → POST /auth/logout → backend clearCookie
        └─> setQueryData(['session'], null) → redirect /login
```

---

## Nota: interceptor de 401 (opcional, fase 2)

Para renovar o token de forma transparente em qualquer chamada de API (não só
em `getSession`), pode-se adicionar um interceptor de resposta no `api` do Axios:

```ts
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true
      const { data } = await api.post('/auth/refresh')
      accessToken = data.token
      error.config.headers['Authorization'] = `Bearer ${accessToken}`
      return api(error.config)
    }
    return Promise.reject(error)
  }
)
```

Isso está **fora do escopo deste plano** — implementar somente se necessário.

---

## Arquivos a alterar

| Arquivo | O que muda |
|---|---|
| `server/auth/auth-routes.ts` | Adicionar `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| `src/contexts/auth/services/auth-service.ts` | Reescrever com token em memória + chamadas reais à API |

### Arquivos que NÃO mudam

- `use-login.ts` — interface do `authService` não muda
- `use-session.ts` — interface do `authService` não muda
- `use-logout.ts` — interface do `authService` não muda
- `use-session.ts` — nenhuma mudança

---

## Checklist

### Backend
- [ ] `POST /auth/refresh` — valida cookie, retorna novo `{ token }`
- [ ] `POST /auth/logout` — limpa cookie, retorna 204
- [ ] `GET /auth/me` — retorna `{ id, email }` do user autenticado
- [ ] Verificar tipos com `pnpm build-server`

### Frontend
- [ ] Reescrever `auth-service.ts` com `accessToken` em memória
- [ ] `login()` → POST /auth/login + GET /auth/me
- [ ] `getSession()` → POST /auth/refresh (se sem token) + GET /auth/me
- [ ] `logout()` → POST /auth/logout + limpa token
- [ ] Helper `fetchMe()` com header `Authorization`
- [ ] Remover toda referência a `localStorage`, mock e delay artificial
