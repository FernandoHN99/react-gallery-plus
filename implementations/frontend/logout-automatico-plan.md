# Plano: Logout Automático ao Expirar Token

## Contexto

Quando o token de acesso (10 minutos) expira, o backend retorna 401 em qualquer requisição.
Atualmente, o frontend não trata isso automaticamente — o usuário fica vendo erro ou a tela fica congelada.

A estratégia é capturar 401 em 2 lugares e redirecionar para `/login` com toast "Sessão expirada".

---

## Objetivo

Implementar logout automático quando:
1. `POST /auth/refresh` falha com 401 (cookie refreshToken expirou)
2. `GET /auth/me` falha com 401 (token de acesso expirou)
3. Qualquer outra requisição falha com 401 (token inválido em qualquer lugar)

Comportamento:
- Toast: "Sessão expirada"
- Redirecionar para `/login` **preservando** o `from` state (para voltar após relogin)
- Limpar `accessToken` em memória

---

## Estratégia em 4 partes

### 1. Try/catch explícito em `src/contexts/auth/services/auth-service.ts`

**Por quê:** Deixar claro quando a autenticação falha, sem depender de retry automático.

```ts
// getSession() — se refresh falhar, token expirou
async getSession(): Promise<User> {
  if (!accessToken) {
    try {
      const { data } = await api.post<{ token: string }>('/auth/refresh')
      accessToken = data.token
    } catch (error) {
      accessToken = null  // limpa token inválido
      throw new Error('RefreshTokenExpired')
    }
  }
  return fetchMe()
}

// fetchMe() — se GET /auth/me falhar, token inválido
async function fetchMe(): Promise<User> {
  try {
    const { data } = await api.get<User>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return data
  } catch (error) {
    accessToken = null
    throw error
  }
}
```

### 2. Interceptor de resposta em `src/helpers/api.ts`

**Por quê:** Capturar 401 em **qualquer** requisição (não só session).

```ts
import axios, { type AxiosRequestConfig } from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

export const fetcher = (url: string, options: AxiosRequestConfig = {}) =>
  api.get(url, options).then((res) => res.data)

// Interceptor global de erro 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido em qualquer lugar da app
      accessToken = null
      window.location.href = '/login'  // redireciona automaticamente
    }
    return Promise.reject(error)
  }
)
```

**Problema:** `accessToken` não é importável de `auth-service.ts` (é `let` privado).

**Solução:** Exportar função que limpa token:

```ts
// Em auth-service.ts, adicionar export:
export function clearAccessToken() {
  accessToken = null
}

// Em api.ts, importar e usar:
import { clearAccessToken } from '../contexts/auth/services/auth-service'

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAccessToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

### 3. Atualizar `src/contexts/auth/hooks/use-session.ts`

**Por quê:** Expor erro e fazer fail-fast com `retry: false`.

```ts
import { useQuery } from '@tanstack/react-query'
import { authService } from '../services/auth-service'

const ONE_HOUR = 1000 * 60 * 60

export default function useSession() {
  const query = useQuery({
    queryKey: ['session'],
    queryFn: authService.getSession,
    staleTime: ONE_HOUR,
    refetchInterval: ONE_HOUR,
    retry: false,  // ← falha rápido em erro de autenticação
  })

  return {
    user: query.data ?? null,
    isLoadingSession: query.isPending,
    isAuthenticated: query.isSuccess && !!query.data?.id,  // ← fix: optional chaining
    isError: query.isError,  // ← novo: expõe erro
  }
}
```

### 4. Atualizar `src/contexts/auth/components/require-auth.tsx`

**Por quê:** Tratar erro de sessão e redirecionar preservando `from` state.

```tsx
import { Navigate, useLocation } from 'react-router'
import { Outlet } from 'react-router'
import useSession from '../hooks/use-session'

export default function RequireAuth() {
  const { isAuthenticated, isLoadingSession, isError } = useSession()
  const location = useLocation()

  // Loading inicial
  if (isLoadingSession) {
    return <FullScreenSpinner />
  }

  // Erro na sessão (token expirou, refresh falhou, etc)
  if (isError) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Sem autenticação (logout ou não logado)
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
```

### 5. (Opcional) Toast de "Sessão expirada" em `page-login.tsx`

**Por quê:** Informar ao usuário por que foi redirecionado.

No `RequireAuth`, antes de redirecionar:

```tsx
if (isError) {
  toast.error('Sessão expirada. Por favor, faça login novamente.')
  return <Navigate to="/login" state={{ from: location }} replace />
}
```

Ou no `page-login.tsx`, verificar se veio de erro:

```tsx
useEffect(() => {
  if (location.state?.from && /* alguma flag de erro */) {
    toast.error('Sessão expirada. Por favor, faça login novamente.')
  }
}, [location])
```

**Problema:** Não há forma de saber se redirecionou por erro ou logout normal.

**Solução:** Usar `sessionStorage` temporário:

```tsx
// Em RequireAuth.tsx
if (isError) {
  sessionStorage.setItem('sessionExpired', 'true')
  return <Navigate to="/login" state={{ from: location }} replace />
}

// Em page-login.tsx
useEffect(() => {
  const sessionExpired = sessionStorage.getItem('sessionExpired')
  if (sessionExpired) {
    toast.error('Sessão expirada. Por favor, faça login novamente.')
    sessionStorage.removeItem('sessionExpired')
  }
}, [])
```

---

## Fluxo completo após implementação

```
Cenário A: Token de acesso expirou (10min)
  └─> Usuário faz requisição (GET /photos)
      └─> Backend retorna 401
          └─> Interceptor Axios captura
              ├─ clearAccessToken()
              └─ window.location = '/login'
                  └─ Redirecionado para /login
                      └─ sessionStorage.sessionExpired = true
                          └─ Toast: "Sessão expirada"

Cenário B: RefreshToken expirou (7 dias / cookie)
  └─> refetchInterval dispara (1h)
      └─> getSession() chamada
          └─> POST /auth/refresh
              └─> Backend retorna 401 (cookie expirado)
                  └─> Try/catch captura erro
                      ├─ accessToken = null
                      └─ lança "RefreshTokenExpired"
                          └─> useQuery.isError = true
                              └─> RequireAuth vê isError
                                  ├─ sessionStorage.sessionExpired = true
                                  └─ Redireciona para /login
                                      └─ Toast: "Sessão expirada"

Cenário C: Logout manual
  └─> Usuário clica "Sair"
      └─> useLogout() executa
          └─> authService.logout()
              ├─ accessToken = null
              └─ POST /auth/logout (limpa cookie no backend)
                  └─> setQueryData(['session'], null)
                      └─ useSession retorna isAuthenticated = false
                          └─ RequireAuth redireciona para /login
                              └─ Sem toast (logout esperado)
```

---

## Arquivos a alterar

| Arquivo | O que muda |
|---|---|
| `src/contexts/auth/services/auth-service.ts` | Try/catch em getSession() e fetchMe(); export clearAccessToken() |
| `src/helpers/api.ts` | Interceptor de resposta para 401 global |
| `src/contexts/auth/hooks/use-session.ts` | retry: false, expõe isError |
| `src/contexts/auth/components/require-auth.tsx` | Trata isError, sessionStorage para toast |
| `src/pages/page-login.tsx` | Mostra toast "Sessão expirada" se aplicável |

---

## Pontos importantes

### ⚠️ Cuidado com chamadas circulares

Se o interceptor redireciona para `/login` e há requisições pendentes, elas falham com 401 de novo.

**Solução:** Flag global para evitar múltiplos redirects:

```ts
let isRedirecting = false

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true
      clearAccessToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)
```

### ⚠️ Token em memória desaparece ao recarregar

Intencional para segurança — ao F5, `accessToken = null` por padrão.

### ⚠️ Cada aba tem seu próprio contexto

Aba 1 faz logout → aba 2 ainda tem token em memória. Não há sincronização entre abas.

---

## Checklist de implementação

- [ ] Try/catch em `getSession()` 
- [ ] Try/catch em `fetchMe()`
- [ ] Export `clearAccessToken()` em `auth-service.ts`
- [ ] Interceptor em `api.ts` com `clearAccessToken()`
- [ ] `retry: false` em `use-session.ts`
- [ ] `isError` em `use-session.ts`
- [ ] Tratamento de `isError` em `RequireAuth.tsx`
- [ ] `sessionStorage.sessionExpired` em `RequireAuth.tsx`
- [ ] Toast em `page-login.tsx` se sessão expirada
- [ ] `pnpm build` — verificar tipos
- [ ] Testar: invalidar accessToken, fazer requisição → logout automático
- [ ] Testar: deixar refreshToken expirar (alterar cookie), refetch → logout automático
- [ ] Testar: logout manual → sem toast
- [ ] Testar: redirect com from state → volta para rota original após relogin

---

## Ordem de implementação

1. `auth-service.ts` — try/catch + export
2. `api.ts` — interceptor
3. `use-session.ts` — retry: false, isError
4. `require-auth.tsx` — tratamento de erro
5. `page-login.tsx` — toast condicional
6. Testes

