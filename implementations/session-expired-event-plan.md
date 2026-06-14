# Session Expired Event

Status: implementado.

## Problema

`sessionExpired` era derivado de `query.data === null` dentro de `useSession`.

Isso misturava dois conceitos diferentes:

- sessao ausente: usuario deslogado, logout manual, acesso inicial sem sessao
- sessao expirada: token invalido ou refresh token invalido/expirado

Como `null` pode representar qualquer usuario nao autenticado, a tela de login acabava mostrando toast de sessao expirada mesmo em fluxos normais de usuario deslogado.

## Decisao

Sessao expirada agora e um evento explicito, armazenado separadamente no React Query:

```ts
['auth', 'session-expired']
```

O evento possui motivo e timestamp:

```ts
type AuthSessionExpiredEvent = {
   reason:
      | 'INVALID_ACCESS_TOKEN'
      | 'INVALID_REFRESH_TOKEN'
      | 'REFRESH_TOKEN_EXPIRED'
   occurredAt: number
}
```

## Fluxo

```txt
Interceptor identifica falha real de autenticacao

INVALID_ACCESS_TOKEN
INVALID_REFRESH_TOKEN
REFRESH_TOKEN_EXPIRED

onAuthSessionExpired(reason)

setQueryData(['session'], null)
setQueryData(['auth', 'session-expired'], event)
POST /auth/logout para limpar o cookie HttpOnly refreshToken

RequireAuth redireciona para /login com sessionExpired=true

PageLogin mostra toast uma vez

PageLogin limpa o evento e remove sessionExpired do location.state
```

## Detalhe importante

`MISSING_ACCESS_TOKEN` tambem acontece quando o usuario esta apenas deslogado, mas o frontend ainda tenta refresh para descobrir se existe uma sessao valida no cookie HttpOnly.

Se o refresh falha por rede, o frontend mostra apenas o toast global de conectividade.

Se o refresh falha com `INVALID_REFRESH_TOKEN` ou `REFRESH_TOKEN_EXPIRED`, o frontend trata como sessao invalida, limpa o cookie via `/auth/logout` e dispara o evento de sessao expirada.

## Efeitos

- Logout manual nao mostra toast de sessao expirada.
- Acesso inicial deslogado sem resposta invalida de refresh nao mostra toast.
- Erro de rede nao mostra toast de sessao expirada.
- Apenas falhas reais de autenticacao disparam o aviso.
- Login e logout limpam qualquer evento antigo para evitar estado residual.
- Logout manual e logout automatico chamam `/auth/logout` para remover o `refreshToken` HttpOnly do cookie.

## Cookie de refresh

Como o `refreshToken` e HttpOnly, o frontend nao consegue remove-lo diretamente via `document.cookie`.

Para logout manual e automatico, o frontend chama `/auth/logout`, que executa `clearCookie('refreshToken')` no backend.

O logout automatico usa `rawApi`, uma instancia Axios sem interceptors, para evitar loop de refresh/logout durante a propria limpeza de sessao.
