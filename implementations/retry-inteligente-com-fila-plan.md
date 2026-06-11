# Retry Inteligente com Fila de Refresh

## Visão Geral

Implementar um sistema profissional de retry automático para requisições autenticadas usando:
- **1 tentativa** de refresh quando token expira
- **Fila singleton** para evitar múltiplos refreshes simultâneos
- **Diferenciação de erros** entre 401 (logout) e 5xx/network (mostrar toast)
- **1 interceptador** que encapsula toda a lógica

---

## Fluxo Geral

### Cenário 1: Token expirado (TOKEN_EXPIRED)

```
GET /photos
↓
401 TOKEN_EXPIRED
↓
[interceptor deteta]
↓
refreshQueue.waitForRefresh()
  └─ POST /auth/refresh
     ├─ sucesso → retorna token
     └─ falha (401 ou network) → trata erro
↓
Se refresh sucesso: GET /photos (refaz com novo token)
Se refresh 401: logout + toast "Sessão expirada"
Se refresh network: toast "Não foi possível renovar sessão"
```

### Cenário 2: Múltiplas requisições simultâneas com 401

```
GET /photos    → 401 TOKEN_EXPIRED
GET /orders    → 401 TOKEN_EXPIRED
GET /dashboard → 401 TOKEN_EXPIRED
                     ↓
[Req 1 dispara refresh]
[Req 2 e 3 aguardam refreshPromise]
                     ↓
POST /auth/refresh → sucesso
                     ↓
Todas 3 repetem com novo token
```

### Cenário 3: Refresh token expirado

```
GET /photos
↓
401 TOKEN_EXPIRED
↓
refreshQueue.waitForRefresh()
  └─ POST /auth/refresh
     ↓
     401 REFRESH_TOKEN_EXPIRED ou INVALID_REFRESH_TOKEN
↓
logout + toast "Sessão expirada. Faça login novamente"
```

### Cenário 4: Servidor ou rede fora

```
GET /photos
↓
401 TOKEN_EXPIRED
↓
refreshQueue.waitForRefresh()
  └─ POST /auth/refresh
     ↓
     500 Internal Server Error (ou timeout, sem response)
↓
toast "Não foi possível renovar sua sessão. Verifique sua conexão"
```

---

## Mudanças Backend

### 1. `server/auth/verify-jwt.ts`

**O que muda:**
- Retornar objeto com `code` e `message` em vez de texto genérico

**Novo conteúdo:**
```typescript
import type { FastifyReply, FastifyRequest } from 'fastify'

export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
   try {
      await request.jwtVerify()
   } catch (error) {
      // O erro é de expiração ou de token inválido?
      // jwt lib lança diferentes mensagens, aqui unificamos como TOKEN_EXPIRED
      return reply.status(401).send({
         code: 'TOKEN_EXPIRED',
         message: 'Access token expirado ou inválido',
      })
   }
}
```

---

### 2. `server/auth/auth-routes.ts` (rota POST /auth/refresh)

**O que muda:**
- Detectar diferentes tipos de falha no refresh
- Retornar código específico

**Mudanças:**

Na rota POST /auth/refresh, onde valida refreshToken:

```typescript
// Se refreshToken não existe no cookie
if (!request.cookies.refreshToken) {
  return reply.status(401).send({
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token não encontrado',
  })
}

// Se refreshToken é inválido/malformado
try {
  await request.jwtVerify({ onlyIfSignedAs: 'refresh' })
} catch (error) {
  // Token expirou ou é inválido
  if (error.message.includes('expired')) {
    return reply.status(401).send({
      code: 'REFRESH_TOKEN_EXPIRED',
      message: 'Refresh token expirado. Faça login novamente.',
    })
  }
  return reply.status(401).send({
    code: 'INVALID_REFRESH_TOKEN',
    message: 'Refresh token inválido',
  })
}

// Se chegou aqui, refresh é válido → issua novo accessToken
const newAccessToken = fastify.jwt.sign({ sub: userId })
return reply.send({ token: newAccessToken })
```

---

## Mudanças Frontend

### 1. Novo arquivo: `src/contexts/auth/services/auth-error-handler.ts`

**Responsabilidade:** Analisar erros HTTP e classificar ação recomendada

```typescript
interface ErrorResponse {
  code?: string
  message?: string
}

export const authErrorHandler = {
  /**
   * Token expirou (mas refreshToken ainda é válido)
   * Ação: tentar refresh
   */
  isTokenExpired(error: any): boolean {
    return error?.response?.data?.code === 'TOKEN_EXPIRED'
  },

  /**
   * Refresh token expirou ou é inválido
   * Ação: logout imediato
   */
  isRefreshTokenInvalid(error: any): boolean {
    const code = error?.response?.data?.code
    return (
      code === 'REFRESH_TOKEN_EXPIRED' ||
      code === 'INVALID_REFRESH_TOKEN'
    )
  },

  /**
   * Não há response (timeout, conexão perdida, etc)
   * Ação: mostrar erro temporário (não logout)
   */
  isNetworkError(error: any): boolean {
    return !error?.response
  },

  /**
   * Extrai mensagem do erro para exibir ao usuário
   */
  getErrorMessage(error: any): string {
    return (
      error?.response?.data?.message ||
      error?.message ||
      'Erro desconhecido'
    )
  },
}
```

---

### 2. Novo arquivo: `src/helpers/refresh-queue.ts`

**Responsabilidade:** Fila singleton de refresh (garante 1 refresh por vez)

```typescript
import { authService, getAccessToken } from '../contexts/auth/services/auth-service'
import { api } from './api'

let refreshPromise: Promise<string> | null = null

/**
 * Aguarda a fila de refresh
 * Se já está refazendo, aguarda a Promise existente
 * Se não, dispara novo refresh
 */
export const refreshQueue = {
  async waitForRefresh(): Promise<string> {
    // Se já existe refresh em andamento, aguarda
    if (refreshPromise) {
      return refreshPromise
    }

    // Senão, dispara novo refresh
    refreshPromise = performRefresh()

    try {
      const token = await refreshPromise
      return token
    } finally {
      // Limpa fila após terminar (sucesso ou erro)
      refreshPromise = null
    }
  },
}

/**
 * Executa o refresh de verdade
 * Retorna novo accessToken ou lança erro
 */
async function performRefresh(): Promise<string> {
  try {
    const { data } = await api.post<{ token: string }>('/auth/refresh')
    
    // Atualiza token em memória
    // (será feito via auth-service exportar uma função setAccessToken)
    
    return data.token
  } catch (error) {
    // Relança o erro para o interceptor tratar
    throw error
  }
}
```

---

### 3. Modificar: `src/contexts/auth/services/auth-service.ts`

**O que muda:**
- Exportar função `setAccessToken()` para que refresh-queue.ts possa atualizar
- Simplificar `getSession()` para não fazer retry (deixa interceptor cuidar)

**Mudanças:**

```typescript
// Nova função
export function setAccessToken(token: string) {
  accessToken = token
}

// getSession() simplificado
async getSession(): Promise<User> {
  if (!accessToken) {
    // O interceptor cuidará do refresh se needed
    // Aqui só tentamos /auth/me
  }
  return fetchMe()
}
```

---

### 4. Modificar: `src/helpers/api.ts`

**O que muda:**
- Reescrever interceptor de response
- Implementar lógica de retry + fila
- Diferenciar erros (401 vs 5xx vs network)

**Novo conteúdo:**

```typescript
import axios, { type AxiosRequestConfig, type AxiosError } from 'axios'
import { clearAccessToken, getAccessToken, setAccessToken } from '../contexts/auth/services/auth-service'
import { authErrorHandler } from '../contexts/auth/services/auth-error-handler'
import { refreshQueue } from './refresh-queue'
import { toast } from 'sonner'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

export const fetcher = (url: string, options: AxiosRequestConfig = {}) =>
  api.get(url, options).then((res) => res.data)

// ============ REQUEST INTERCEPTOR ============
// Adiciona Authorization header com accessToken
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ============ RESPONSE INTERCEPTOR ============
let isRedirecting = false

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const { status, data: responseData } = error.response || {}

    // === CASO 1: 401 TOKEN_EXPIRED (não vindo de /auth/refresh) ===
    if (
      status === 401 &&
      authErrorHandler.isTokenExpired(error) &&
      !error.config?.url?.includes('/auth/refresh')
    ) {
      try {
        // Aguarda refresh (fila singleton)
        const newToken = await refreshQueue.waitForRefresh()
        setAccessToken(newToken)

        // Refaz request original com novo token
        if (error.config) {
          error.config.headers.Authorization = `Bearer ${newToken}`
          return api.request(error.config)
        }
      } catch (refreshError) {
        // === Se refresh falhou ===

        if (authErrorHandler.isRefreshTokenInvalid(refreshError)) {
          // Refresh retornou 401 (REFRESH_TOKEN_EXPIRED ou INVALID_REFRESH_TOKEN)
          performLogout()
          toast.error('Sessão expirada. Faça login novamente.')
        } else if (authErrorHandler.isNetworkError(refreshError)) {
          // Erro de rede, timeout, 5xx, etc
          toast.error(
            'Não foi possível renovar sua sessão. Verifique sua conexão.'
          )
        }

        return Promise.reject(refreshError)
      }
    }

    // === CASO 2: 401 vindo de /auth/refresh (refresh token inválido) ===
    if (
      status === 401 &&
      error.config?.url?.includes('/auth/refresh')
    ) {
      performLogout()
      toast.error('Sessão expirada. Faça login novamente.')
      return Promise.reject(error)
    }

    // === Qualquer outro erro: passa adiante ===
    return Promise.reject(error)
  },
)

function performLogout() {
  if (isRedirecting) return
  isRedirecting = true
  clearAccessToken()
  sessionStorage.setItem('sessionExpired', 'true')
  window.location.href = '/login'
}
```

---

### 5. Modificar: `src/contexts/auth/hooks/use-session.ts`

**O que muda:**
- Nada! Permanece igual.

(Já está configurado corretamente com `retry: false`)

---

### 6. Modificar: `src/contexts/auth/components/require-auth.tsx`

**O que muda:**
- Pode remover lógica de "sessionStorage check" se preferir
- Agora o toast é mostrado no interceptor, não aqui

(Opcional simplificar)

---

## Arquivos a modificar/criar

```
Backend:
  ✏️ server/auth/verify-jwt.ts
  ✏️ server/auth/auth-routes.ts

Frontend:
  ✨ src/contexts/auth/services/auth-error-handler.ts (NOVO)
  ✨ src/helpers/refresh-queue.ts (NOVO)
  ✏️ src/helpers/api.ts (reescrever)
  ✏️ src/contexts/auth/services/auth-service.ts (adicionar setAccessToken)
```

---

## Fluxo de implementação

### Step 1: Backend
1. Modificar `verify-jwt.ts` para retornar codes
2. Modificar `auth-routes.ts` POST /refresh para retornar codes
3. Testar com Postman/curl

### Step 2: Frontend
1. Criar `auth-error-handler.ts`
2. Criar `refresh-queue.ts`
3. Modificar `auth-service.ts` (adicionar setAccessToken)
4. Reescrever `api.ts` com novo interceptor
5. Testar fluxo completo

### Step 3: Testes
1. Login → fazer requisição → tudo OK
2. Esperar token expirar (5s) → fazer requisição → refresh automático + retry
3. Deslogar manualmente → fazer requisição → logout force
4. Desligar servidor → fazer requisição → toast erro rede

---

## Checklist de validação

- [ ] Backend retorna codes de erro corretos
- [ ] Frontend detecta TOKEN_EXPIRED e tenta refresh
- [ ] Multiple requests usam a fila (só 1 refresh)
- [ ] Refresh token inválido faz logout
- [ ] Erro de rede não faz logout
- [ ] Toast "Sessão expirada" aparece
- [ ] Toast "Não foi possível renovar" aparece
- [ ] pnpm build-server passa
- [ ] Sem erros no console

---

## Notas importantes

1. **`refreshQueue` é singleton**: Mesmo que 10 requisições falhem com 401 ao mesmo tempo, só 1 refresh é disparado
2. **Sem exagero**: Apenas 1 tentativa, sem retry exponencial
3. **Erros diferenciados**: 401 logout / 5xx toast
4. **Toast com Sonner**: Importar corretamente
5. **Fila limpa**: Usa try/finally para garantir limpeza mesmo em erro

---

## Possíveis melhorias futuras (Phase 2)

- [ ] Persistir fila em localStorage (para survive page reload)
- [ ] Retry automático para requisições que falharam por network
- [ ] Rate limiting de toasts (não mostrar 10x "não foi possível renovar")
- [ ] Analytics: log quantas requisições foram retried
