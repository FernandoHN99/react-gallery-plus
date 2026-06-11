# Retry Inteligente com Fila + Detecção de Sessão Expirada

## Visão Geral (REVISADO)

Implementar um sistema **robusto e profissional** de retry automático para requisições autenticadas, com **separação clara de responsabilidades**:

- **Interceptor** (`api.ts`): Apenas renova token + refaz request. Não redireciona.
- **React Query** (via `use-session.ts`): Detecta "sessão expirada" vs "visitante novo" usando `isRefetchError`
- **RequireAuth**: Único responsável por navegação (soft redirect via React Router)
- **Página de Login**: Mostra toast apenas quando sessão expirou durante o uso

---

## Root Cause do Problema Anterior

O interceptor estava confundindo dois cenários:

1. **Visitante novo** (nunca logou): `GET /auth/me` sem token → 401 → tenta refresh → falha → logout forçado (ERRADO)
2. **Sessão expirada** (estava logado): refetch de `/auth/me` → 401 → tenta refresh → falha → logout (CORRETO)

Ambos resultavam em `INVALID_REFRESH_TOKEN`, então o interceptor não podia distinguir. Solução: deixar a detecção para o React Query, que já sabe a diferença via `isRefetchError` (tinha dados antes) vs `isLoadingError` (nunca teve dados).

---

## Fluxos Esperados

### Cenário 1: Visitante novo abre a app

```
Browser carrega App
   ↓
RequireAuth carrega → useSession() → getSession() → GET /auth/me
   ↓
accessToken = null (memória) → SEM header Authorization
   ↓
Backend: verifyJwt falha → 401 TOKEN_EXPIRED
   ↓
Interceptor: TOKEN_EXPIRED → tenta refresh
   ↓
POST /auth/refresh (SEM cookie, nunca logou) → 401 INVALID_REFRESH_TOKEN
   ↓
Interceptor: refresh falhou + é erro de rede/5xx? NÃO → rejeita erro silenciosamente
   ↓
React Query: query.isLoadingError = true (primeira busca falhou)
   ↓
RequireAuth: !isAuthenticated → <Navigate to="/login" state={{ sessionExpired: false }}>
   ↓
page-login: location.state.sessionExpired = false → SEM toast ✅
```

### Cenário 2: Usuário logado, sessão expira durante uso

```
(Usuário logado, navegando normalmente, accessToken em memória)
   ↓
refetchInterval de useSession() dispara → GET /auth/me
   ↓
Header: Authorization: Bearer <old_token>
   ↓
Backend: token expirou → 401 TOKEN_EXPIRED
   ↓
Interceptor: TOKEN_EXPIRED + não é refetchCall + !_retry
   ↓
refreshQueue.waitForRefresh() → POST /auth/refresh
   ↓
(refreshToken ainda válido no cookie)
   ↓
Backend: issuea novo accessToken → 200 { token: "new_token" }
   ↓
Interceptor: setAccessToken("new_token") + refaz GET /auth/me com novo token
   ↓
GET /auth/me (com novo token) → 200 + data ✅
   ↓
(usuário continua navegando, sem saber que nada aconteceu)
```

### Cenário 3: Sessão expira E refreshToken também expirou

```
(Usuário logado, accessToken venceu, refreshToken também venceu)
   ↓
refetchInterval → GET /auth/me → 401 TOKEN_EXPIRED
   ↓
Interceptor: tenta refresh → POST /auth/refresh
   ↓
Backend: jwtVerify({ onlyCookie: false }) falha → 401 REFRESH_TOKEN_EXPIRED
   ↓
Interceptor: catch(refreshError) → authErrorHandler.isRefreshTokenInvalid() = true
   ↓
clearAccessToken() → rejeita erro
   ↓
React Query: query.isRefetchError = true (tinha user antes, refetch falhou)
   ↓
RequireAuth: !isAuthenticated + sessionExpired=true → <Navigate state={{ sessionExpired: true }}>
   ↓
page-login: toast "Sessão expirada. Por favor, faça login novamente." ✅
```

### Cenário 4: Servidor fora do ar (erro temporário)

```
GET /auth/me → timeout ou 5xx
   ↓
Interceptor: isNetworkError() = true
   ↓
toast.error('Não foi possível renovar sua sessão. Verifique sua conexão.')
   ↓
rejeita erro (não limpa token, deixa usuário tentar novamente)
   ↓
page permanece, usuário pode clicar retry ou esperar
```

### Cenário 5: Token expira MAS múltiplas requisições simultâneas

```
GET /photos → 401 TOKEN_EXPIRED
GET /orders → 401 TOKEN_EXPIRED
GET /dashboard → 401 TOKEN_EXPIRED
                    ↓
[Primeira request entra no interceptor]
   refreshQueue.waitForRefresh() → refreshPromise = performRefresh()
   
[Outras requests entram]
   refreshQueue.waitForRefresh() → refreshPromise já existe → aguardam
   
[Refresh termina com sucesso]
   refreshPromise = null (limpeza)
   
[Todas 3 requests refazem com novo token]
   ↓
GET /photos (novo token) → 200
GET /orders (novo token) → 200
GET /dashboard (novo token) → 200
   ↓
Usuário vê 3 requisições bem-sucedidas, sem perceber que ocorreu refresh ✅
```

---

## Arquitetura de Componentes

```
┌─────────────────────────────────────────┐
│  RequireAuth (navegação)                 │
│  - Único redirect (soft via React Router)│
│  - Passa sessionExpired no state         │
└─────────────────────┬───────────────────┘
                      │ isAuthenticated?
                      │
         ┌────────────┴────────────┐
         │                         │
         ▼                         ▼
    Outlet (rotas        Navigate("/login"
    protegidas)          state={{ sessionExpired }})
                         │
                         ▼
                  ┌──────────────────┐
                  │  PageLogin       │
                  │  - Toast via     │
                  │    location.state│
                  └──────────────────┘

┌──────────────────────────────────────────┐
│  useSession Hook (gerencia estado)       │
│  - query (TanStack Query)                │
│  - isRefetchError → sessionExpired       │
│  - isLoadingError → visitante novo       │
└──────────────────┬───────────────────────┘
                   │
                   ▼
           ┌───────────────┐
           │  authService  │
           │  - getSession()│
           │  - login()    │
           │  - logout()   │
           └───────┬───────┘
                   │
                   ▼
      ┌────────────────────────┐
      │  Axios + Interceptores │
      │  - Request: add token  │
      │  - Response: retry 401 │
      │    + fila singleton    │
      │    + _retry guard      │
      └────────────┬───────────┘
                   │
                   ▼
      ┌────────────────────────┐
      │  refreshQueue          │
      │  - waitForRefresh()    │
      │  - Garante 1 refresh   │
      │    por vez             │
      └────────────┬───────────┘
                   │
                   ▼
           ┌───────────────┐
           │  Backend      │
           │  - /auth/me   │
           │  - /auth/refresh
           │  - Codes: TOKEN_EXPIRED,
           │    REFRESH_TOKEN_EXPIRED,
           │    INVALID_REFRESH_TOKEN
           └───────────────┘
```

---

## Mudanças Necessárias

### 1. Backend (JÁ FEITO, sem mudanças)

- ✅ `server/auth/verify-jwt.ts` → retorna `{ code: 'TOKEN_EXPIRED' }`
- ✅ `server/auth/auth-routes.ts` → retorna codes específicos no `/auth/refresh`

---

### 2. Frontend - `src/helpers/api.ts` (REESCREVER)

**Remover:**
- ~~`performLogout()` function~~
- ~~`window.location.href`~~
- ~~`isRedirecting` flag~~
- ~~`sessionStorage.setItem('sessionExpired')`~~
- ~~Toast de "Sessão expirada"~~
- ~~`clearAccessToken` import relacionado a redirect~~

**Manter/Adicionar:**
- Renovação de token com fila
- `_retry` flag para evitar loop infinito
- Toast de erro de rede
- Detecção de calls to `/auth/refresh` para skip retry

```typescript
import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { authErrorHandler } from '../contexts/auth/services/auth-error-handler'
import {
   clearAccessToken,
   getAccessToken,
   setAccessToken,
} from '../contexts/auth/services/auth-service'
import { refreshQueue } from './refresh-queue'

export const api = axios.create({
   baseURL: import.meta.env.VITE_API_URL,
   withCredentials: true,
})

export const fetcher = (url: string, options: AxiosRequestConfig = {}) =>
   api.get(url, options).then((res) => res.data)

// ============ REQUEST INTERCEPTOR ============
// Adiciona Authorization header com accessToken a todas as requisições
api.interceptors.request.use((config) => {
   const token = getAccessToken()
   if (token) {
      config.headers.Authorization = `Bearer ${token}`
   }
   return config
})

// ============ RESPONSE INTERCEPTOR ============
api.interceptors.response.use(
   (response) => response,
   async (error: AxiosError) => {
      const originalRequest = error.config
      const { status } = error.response || {}

      // Flag para evitar retry infinito da mesma request
      const alreadyRetried = (originalRequest as any)?._retry
      const isRefreshCall = originalRequest?.url?.includes('/auth/refresh')

      // === CASO: 401 TOKEN_EXPIRED (não vindo de /auth/refresh, primeira tentativa) ===
      if (
         status === 401 &&
         authErrorHandler.isTokenExpired(error) &&
         !isRefreshCall &&
         !alreadyRetried
      ) {
         try {
            // Marca como retentada para evitar retry duplicado
            (originalRequest as any)._retry = true

            // Aguarda fila de refresh (pode ser uma request anterior já refazendo)
            const newToken = await refreshQueue.waitForRefresh()

            // Atualiza token em memória
            setAccessToken(newToken)

            // Refaz request original com novo token
            originalRequest!.headers.Authorization = `Bearer ${newToken}`
            return api.request(originalRequest!)
         } catch (refreshError) {
            // === Refresh falhou ===

            // Limpa token em memória de qualquer forma
            clearAccessToken()

            // Se for erro de rede/timeout/5xx: mostra toast
            // Se for 401 (REFRESH_TOKEN_EXPIRED/INVALID): rejeita silenciosamente
            // (React Query vai tratar com isRefetchError)
            if (authErrorHandler.isNetworkError(refreshError)) {
               toast.error(
                  'Não foi possível renovar sua sessão. Verifique sua conexão.',
               )
            }

            return Promise.reject(refreshError)
         }
      }

      // === Qualquer outro erro (não 401, ou 401 já retentado, ou erro em /auth/refresh) ===
      return Promise.reject(error)
   },
)
```

---

### 3. Frontend - `src/contexts/auth/hooks/use-session.ts` (ADICIONAR FLAG)

**Adicionar:**
- `sessionExpired` usando `query.isRefetchError`

```typescript
import { useQuery } from '@tanstack/react-query'
import { authService } from '../services/auth-service'

const ONE_HOUR = 1000 * 60 * 60

export default function useSession() {
   const query = useQuery({
      queryKey: ['session'],
      queryFn: authService.getSession,
      staleTime: ONE_HOUR,
      refetchInterval: ONE_HOUR,
      retry: false,
   })

   return {
      user: query.data ?? null,
      isLoadingSession: query.isPending,
      isAuthenticated: query.isSuccess && !!query.data?.id,
      sessionExpired: query.isRefetchError, // Tinha dados, refetch falhou = sessão expirou
   }
}
```

---

### 4. Frontend - `src/contexts/auth/components/require-auth.tsx` (REESCREVER NAVEGAÇÃO)

**Mudar de:**
- Hard redirect `window.location.href`
- Navegação duplicada (interceptor + RequireAuth)

**Para:**
- Soft redirect `<Navigate>`
- RequireAuth como **único** ponto de navegação
- Passar `sessionExpired` no `state`

```typescript
import { Navigate, Outlet, useLocation } from 'react-router'
import useSession from '../hooks/use-session'

export default function RequireAuth() {
   const { isAuthenticated, isLoadingSession, sessionExpired } = useSession()
   const location = useLocation()

   if (isLoadingSession) {
      return (
         <div className="flex h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-primary border-t-accent-brand" />
         </div>
      )
   }

   if (!isAuthenticated) {
      return (
         <Navigate
            to="/login"
            state={{ from: location, sessionExpired }}
            replace
         />
      )
   }

   return <Outlet />
}
```

---

### 5. Frontend - `src/pages/page-login.tsx` (TROCAR sessionStorage POR location.state)

**Remover:**
- ~~`sessionStorage.getItem('sessionExpired')`~~
- ~~`sessionStorage.removeItem('sessionExpired')`~~

**Adicionar:**
- `location.state?.sessionExpired` (vem do RequireAuth)

```typescript
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import Logo from '../assets/images/galeria-plus-full-logo.svg?react'
import Button from '../components/button'
import InputText from '../components/input-text'
import Text from '../components/text'
import useLogin from '../contexts/auth/hooks/use-login'
import { type LoginFormSchema, loginFormSchema } from '../contexts/auth/schemas'
import { MOCK_CREDENTIALS } from '../contexts/auth/services/auth-service'

export default function PageLogin() {
   const navigate = useNavigate()
   const location = useLocation()
   const { login, isLoggingIn } = useLogin()

   const from = (location.state?.from?.pathname as string) ?? '/'
   const sessionExpired = location.state?.sessionExpired as boolean | undefined

   useEffect(() => {
      // Mostra toast apenas se a sessão expirou (não no acesso inicial)
      if (sessionExpired) {
         toast.error('Sessão expirada. Por favor, faça login novamente.')
      }
   }, [sessionExpired])

   const {
      register,
      handleSubmit,
      formState: { errors },
   } = useForm<LoginFormSchema>({
      resolver: zodResolver(loginFormSchema),
   })

   async function onSubmit(data: LoginFormSchema) {
      try {
         await login(data)
         navigate(from, { replace: true })
      } catch {
         toast.error('E-mail ou senha inválidos')
      }
   }

   return (
      <div className="flex min-h-screen items-center justify-center">
         <div className="flex w-full max-w-sm flex-col items-center gap-8 px-4">
            <Logo className="h-6" />

            <form
               onSubmit={handleSubmit(onSubmit)}
               className="flex w-full flex-col gap-4"
            >
               <div className="flex flex-col gap-1">
                  <Text variant="label-small" className="text-accent-paragraph">
                     E-mail
                  </Text>
                  <InputText
                     type="email"
                     placeholder="admin@gallery.com"
                     error={errors.email?.message}
                     {...register('email')}
                     value="admin@gallery.com"
                  />
               </div>

               <div className="flex flex-col gap-1">
                  <Text variant="label-small" className="text-accent-paragraph">
                     Senha
                  </Text>
                  <InputText
                     type="password"
                     placeholder="••••••"
                     error={errors.password?.message}
                     {...register('password')}
                     value="123456"
                  />
               </div>

               <Button
                  type="submit"
                  className="mt-2 w-full"
                  handling={isLoggingIn}
                  disabled={isLoggingIn}
               >
                  Entrar
               </Button>
            </form>

            <Text
               variant="paragraph-small"
               className="text-center text-placeholder"
            >
               Use <strong>{MOCK_CREDENTIALS.email}</strong> /{' '}
               <strong>{MOCK_CREDENTIALS.password}</strong>
            </Text>
         </div>
      </div>
   )
}
```

---

## Padrões Profissionais Validados

✅ **`_retry` flag** — Impede retry infinito (padrão `axios-auth-refresh`)  
✅ **`isRefetchError`** — Detecta "sessão expirada" vs "visitante novo" (TanStack Query nativo)  
✅ **Fila singleton** — Evita N refreshes simultâneos  
✅ **Soft redirect** — React Router `<Navigate>` em vez de `window.location.href`  
✅ **Separação de responsabilidades** — Interceptor (token), RequireAuth (navegação), página (UI)  
✅ **Skip refresh call** — Não tenta refrescar a própria rota de refresh  

---

## Checklist de Implementação

- [ ] Reescrever `src/helpers/api.ts`
- [ ] Atualizar `src/contexts/auth/hooks/use-session.ts`
- [ ] Reescrever `src/contexts/auth/components/require-auth.tsx`
- [ ] Atualizar `src/pages/page-login.tsx`
- [ ] `pnpm build-server` sem erros
- [ ] `pnpm build` sem erros
- [ ] Testar boot sem login (sem toast)
- [ ] Testar login normal
- [ ] Testar sessão expirada (mudar `expiresIn` pra `5s`, esperar + fazer request)
- [ ] Testar múltiplas requests simultâneas com token expirado
- [ ] Testar servidor down (sem logout, apenas toast)

---

## Notas Importantes

1. **`sessionStorage`** foi removido completamente — não é necessário com `isRefetchError`
2. **`window.location.href`** foi removido — React Router `<Navigate>` é mais limpo e preserva estado
3. **Toast de sessão expirada** é mostrado **apenas** quando `isRefetchError` (tinha dados antes), não no boot inicial
4. **Erro de rede** ainda mostra toast, mas **não desconecta** — usuário pode retry
5. **`getSession()`** no boot tentará refresh automaticamente se houver cookie válido (fluxo normal)

---

## Benefícios desta Arquitetura

| Benefício | Como |
|-----------|------|
| Sem loops infinitos | Flag `_retry` na request original |
| Token renovado transparente | Interceptor + fila singleton |
| Sem false positives de "sessão expirada" | `isRefetchError` do React Query |
| UX prévia e consistente | Toast somente em caso de real expiração |
| Sem hard redirects | Soft redirect via React Router |
| Responsabilidades claras | Interceptor (token), RequireAuth (navegação), página (UI) |
| Profissional e testável | Segue padrões do `axios-auth-refresh` e TanStack Query |

