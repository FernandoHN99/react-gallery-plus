# Auth Client Responsibility Split

Status: implementado.

## Problema

`src/helpers/api.ts` concentrava responsabilidades demais:

- criacao das instancias Axios
- `fetcher`
- request interceptor
- response interceptor
- refresh retry
- expiracao de sessao
- limpeza do cookie de refresh

Tambem existia um ciclo conceitual entre `api.ts` e `auth-service.ts`:

```txt
api.ts -> auth-service.ts -> api.ts
```

## Decisao

Separar o cliente HTTP, o interceptor, a store do access token e as chamadas HTTP de auth.

## Estrutura

```txt
src/helpers/api.ts
   cria api
   cria rawApi
   registra setupAuthInterceptors()
   exporta fetcher

src/helpers/auth-interceptor.ts
   request interceptor
   response interceptor
   retryWithRefresh()
   expireSession()
   tratamento global de NETWORK

src/helpers/refresh-queue.ts
   controla uma unica promise de refresh em andamento
   nao conhece Axios nem endpoints

src/contexts/auth/services/access-token-store.ts
   getAccessToken()
   setAccessToken()
   clearAccessToken()

src/contexts/auth/services/auth-api.ts
   loginRequest()
   fetchMeRequest()
   logoutRequest()

src/contexts/auth/services/auth-service.ts
   login()
   getSession()
   logout()
```

## Resultado

`api.ts` voltou a ser infraestrutura HTTP.

`auth-service.ts` ficou responsavel por orquestrar regras de autenticacao, sem conhecer detalhes de Axios.

`auth-interceptor.ts` ficou responsavel pela estrategia de erro, refresh e expiracao de sessao.

`refresh-queue.ts` ficou reutilizavel e sem dependencia de `api`.

## Dependencias

```txt
auth-service.ts -> auth-api.ts
auth-service.ts -> access-token-store.ts

auth-api.ts -> helpers/api.ts

helpers/api.ts -> auth-interceptor.ts

auth-interceptor.ts -> access-token-store.ts
auth-interceptor.ts -> auth-error-handler.ts
auth-interceptor.ts -> auth-events.ts
auth-interceptor.ts -> refresh-queue.ts

refresh-queue.ts -> sem dependencias de auth/api
```

O ciclo direto entre `api.ts` e `auth-service.ts` foi removido.
