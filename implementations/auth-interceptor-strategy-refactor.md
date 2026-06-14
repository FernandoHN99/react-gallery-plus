# Auth Interceptor Strategy Refactor

Status: implementado.

## Objetivo

Separar a classificacao do erro da decisao operacional do interceptor.

Antes, o response interceptor decidia ao mesmo tempo o que aconteceu e o que fazer. Agora, `authErrorHandler.getReason(error)` classifica o erro e o interceptor apenas despacha para a estrategia correta.

Essa estrategia fica em `src/helpers/auth-interceptor.ts`. `src/helpers/api.ts` apenas cria as instancias Axios e registra `setupAuthInterceptors()`.

## Estados

```ts
type AuthErrorReason =
   | 'TOKEN_EXPIRED'
   | 'MISSING_ACCESS_TOKEN'
   | 'INVALID_ACCESS_TOKEN'
   | 'REFRESH_TOKEN_EXPIRED'
   | 'INVALID_REFRESH_TOKEN'
   | 'NETWORK'
   | null
```

## Fluxo

```txt
Response error

getReason(error)

TOKEN_EXPIRED / MISSING_ACCESS_TOKEN
   tenta refresh
   refresh OK: atualiza access token e refaz request original
   refresh falhou por rede: limpa access token e rejeita
   refresh falhou por token invalido/expirado: expira sessao

INVALID_ACCESS_TOKEN / INVALID_REFRESH_TOKEN
   limpa access token e expira sessao

REFRESH_TOKEN_EXPIRED
   limpa access token e expira sessao quando nao for a propria chamada /auth/refresh

NETWORK
   mostra toast global e rejeita

null
   rejeita sem tratamento especial
```

## Helpers

`retryWithRefresh(originalRequest)` centraliza a fila de refresh, atualiza o token em memoria, injeta o novo `Authorization` e refaz a request original.

`handleRefreshFailure(error)` limpa o access token e decide se apenas rejeita erro de rede ou se expira a sessao.

`expireSession(error, reason)` limpa o access token, dispara `onAuthSessionExpired(reason)` e rejeita o erro original.

`clearRefreshTokenCookie()` chama `/auth/logout` usando `rawApi` para remover o cookie HttpOnly `refreshToken` sem criar loop de refresh/logout.

`rejectNetworkError(error)` exibe o toast global de conectividade e rejeita o erro.
