# Plano: Sistema de Autenticação (Login/Senha)

## Contexto

O projeto não possui API de autenticação real. A implementação simula o fluxo
completo — login, sessão, logout — usando `localStorage` como "token store" e
delays artificiais para imitar latência de rede. O TanStack Query gerencia o
estado de sessão com re-validação automática a cada 1 hora via `refetchInterval`.

**Credenciais fixas para simulação:** `admin@gallery.com` / `123456`

---

## Arquitetura

```
src/
├── contexts/
│   └── auth/
│       ├── models/
│       │   └── user.ts                  # Tipo User
│       ├── services/
│       │   └── auth-service.ts          # Funções simuladas: login, getSession, logout
│       ├── hooks/
│       │   ├── use-session.ts           # useQuery — verifica sessão a cada 1h
│       │   ├── use-login.ts             # useMutation — realiza login
│       │   └── use-logout.ts            # useMutation — realiza logout
│       ├── components/
│       │   └── require-auth.tsx         # Wrapper de rota protegida
│       └── schemas.ts                   # Schema Zod do form de login
└── pages/
    └── page-login.tsx                   # Página de login

Arquivos modificados:
  src/App.tsx                            # Adiciona rota /login e RequireAuth
  src/components/main-header.tsx         # Adiciona botão de logout
```

---

## Detalhamento por arquivo

### 1. `models/user.ts`
```ts
export interface User {
  id: string
  name: string
  email: string
}
```

---

### 2. `services/auth-service.ts`

Simula uma API real com `setTimeout`. O "token" é o objeto `User` serializado
em `localStorage` sob a chave `gallery_plus_token`.

```ts
const TOKEN_KEY = 'gallery_plus_token'
const MOCK_USER: User = { id: '1', name: 'Admin', email: 'admin@gallery.com' }
const MOCK_CREDENTIALS = { email: 'admin@gallery.com', password: '123456' }

export const authService = {
  // Simula POST /auth/login — 600ms de delay
  async login(email: string, password: string): Promise<User> { ... }

  // Simula GET /auth/me — 300ms de delay — chamado a cada 1h pelo useQuery
  async getSession(): Promise<User> { ... }

  // Simula POST /auth/logout — 200ms de delay
  async logout(): Promise<void> { ... }
}
```

---

### 3. `schemas.ts`

Validação Zod para o formulário de login, seguindo o padrão já usado no projeto
(ex: `src/contexts/albums/schemas.ts`).

```ts
export const loginFormSchema = z.object({
  email: z.string().email({ message: 'E-mail inválido' }),
  password: z.string().min(1, { message: 'Campo obrigatório' }),
})
```

---

### 4. `hooks/use-session.ts`

Ponto central da autenticação. Usa `useQuery` para verificar a sessão ativa.

```ts
const ONE_HOUR = 1000 * 60 * 60

useQuery({
  queryKey: ['session'],
  queryFn: authService.getSession,
  staleTime: ONE_HOUR,          // dados são "frescos" por 1h — não refetch desnecessário
  refetchInterval: ONE_HOUR,    // re-valida sessão no servidor a cada 1h
  retry: false,                 // erro = sessão inválida, não tentar novamente
})
```   

**Retorno:**
- `user: User | null`
- `isLoadingSession: boolean` — true apenas no primeiro carregamento
- `isAuthenticated: boolean` — isSuccess && data != null

---

### 5. `hooks/use-login.ts`

```ts
useMutation({
  mutationFn: ({ email, password }) => authService.login(email, password),
  onSuccess: (user) => {
    // Injeta o usuário no cache sem precisar refetch
    queryClient.setQueryData(['session'], user)
  },
})
```

**Por que `setQueryData`?** Evita um round-trip extra para `getSession` logo
após o login. O cache é atualizado de forma otimista e imediata.

---

### 6. `hooks/use-logout.ts`

```ts
useMutation({
  mutationFn: authService.logout,
  onSuccess: () => {
    // Marca a sessão como null — RequireAuth redireciona instantaneamente
    queryClient.setQueryData(['session'], null)
  },
})
```

**Por que `setQueryData(null)` em vez de `removeQueries`?**
`removeQueries` colocaria o query em `isPending`, gerando um breve loading antes
do redirect. `setQueryData(null)` é síncrono e o redirect acontece na mesma
renderização.

---

### 7. `components/require-auth.tsx`

Componente de rota que protege todas as rotas internas. Padrão oficial do
React Router (documentado em `/remix-run/react-router`).

```tsx
export default function RequireAuth() {
  const { isAuthenticated, isLoadingSession } = useSession()
  const location = useLocation()

  if (isLoadingSession) return <FullScreenSpinner />

  if (!isAuthenticated) {
    // Salva o path original para redirecionar após login
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
```

---

### 8. `pages/page-login.tsx`

- React Hook Form + zodResolver (mesmo padrão dos dialogs existentes)
- Componentes visuais: `InputText`, `Button`, `Text` (já existentes no projeto)
- Logo do app (`galeria-plus-full-logo.svg?react`)
- Após login: redireciona para `location.state.from` ou `/`
- Erro de credenciais: `toast.error()` via Sonner (já configurado no App)

---

### 9. `App.tsx` (modificação)

```tsx
<Routes>
  {/* Rota pública */}
  <Route path="/login" element={<PageLogin />} />

  {/* RequireAuth envolve tudo que precisa estar autenticado */}
  <Route element={<RequireAuth />}>
    <Route element={<LayoutMain />}>
      <Route index element={<PageHome />} />
      <Route path="/fotos/:id" element={<PagePhotoDetails />} />
      <Route path="/componentes" element={<PageComponents />} />
    </Route>
  </Route>
</Routes>
```

---

### 10. `main-header.tsx` (modificação)

Adiciona ao final do header:
- Nome do usuário logado (`user.name`)
- Botão "Sair" usando `useLogout` + `handling={isLoggingOut}`

---

## Fluxo completo

```
App carrega
  └─> RequireAuth monta
        └─> useSession: isPending=true → mostra spinner
              └─> getSession() executa (300ms delay)
                    ├─ token no localStorage? → isAuthenticated=true → renderiza app
                    └─ sem token? → isAuthenticated=false → redirect /login

Usuário faz login
  └─> useLogin.mutateAsync({ email, password })
        └─> authService.login (600ms) → sucesso
              └─> setQueryData(['session'], user) → isAuthenticated=true instantaneamente
                    └─> navigate(from, { replace: true }) → volta para rota original

A cada 1 hora
  └─> TanStack Query chama getSession() em background
        ├─ token ainda válido → sessão continua
        └─ token expirado/removido → isAuthenticated=false → redirect /login

Usuário faz logout
  └─> useLogout.mutateAsync()
        └─> authService.logout → remove do localStorage
              └─> setQueryData(['session'], null) → isAuthenticated=false instantaneamente
                    └─> RequireAuth redireciona para /login
```

---

## Checklist de implementação

- [x] `src/contexts/auth/models/user.ts`
- [x] `src/contexts/auth/services/auth-service.ts`
- [x] `src/contexts/auth/schemas.ts`
- [x] `src/contexts/auth/hooks/use-session.ts`
- [x] `src/contexts/auth/hooks/use-login.ts`
- [x] `src/contexts/auth/hooks/use-logout.ts`
- [x] `src/contexts/auth/components/require-auth.tsx`
- [x] `src/pages/page-login.tsx`
- [x] Modificar `src/App.tsx`
- [x] Modificar `src/components/main-header.tsx`
