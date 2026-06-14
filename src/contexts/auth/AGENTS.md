# Frontend Auth Context

## Scope

This file documents `src/contexts/auth/`.

## Token Model

- The access token is stored only in module memory through `services/access-token-store.ts`.
- The access token disappears on reload and each browser tab has its own memory state.
- The refresh token is an `HttpOnly` backend cookie and is not accessible to frontend JavaScript.
- Login, automatic session expiration, and manual logout all rely on backend routes to set or clear the refresh cookie.

## Services

- `auth-api.ts` owns HTTP calls: `loginRequest()`, `fetchMeRequest()`, and `logoutRequest()`.
- `auth-service.ts` orchestrates auth behavior and should not know Axios interceptor details.
- `auth-service.login()` calls `loginRequest()`, stores the returned access token, then fetches the authenticated user.
- `auth-service.getSession()` fetches the authenticated user; if the access token is missing or expired, the global interceptor handles refresh and retries the request.
- `auth-service.logout()` clears the in-memory access token and calls `/auth/logout` through `logoutRequest()`.
- `fetchMe()` clears the access token when fetching the current user fails.

`MOCK_CREDENTIALS` is only a demo display helper for the login page. Authentication uses the real backend API.

## Hooks

- `useSession()` owns the `['session']` query and uses `authService.getSession` with `staleTime` and `refetchInterval` of one hour.
- `useSession()` uses `retry: false`; auth errors should fail fast instead of retrying blindly.
- `useSession()` returns `user`, `isLoadingSession`, and `isAuthenticated`.
- Do not derive `sessionExpired` from `query.data === null`; `null` also represents a normal unauthenticated user.
- `useLogin()` uses `useMutation`, clears old session-expired events on success, and writes the user into `['session']` with `setQueryData`.
- `useLogout()` uses `useMutation`, clears session-expired events, and writes `null` into `['session']` with `setQueryData`.

## Route Guard And Login UX

- `RequireAuth` is the only auth component responsible for redirecting protected routes to `/login`.
- `RequireAuth` uses React Router `<Navigate>` and preserves `from` in `location.state`.
- Do not add `window.location.href` or `sessionStorage` redirects for normal auth flow.
- `RequireAuth` reads the disabled `['auth', 'session-expired']` query to know whether the login page should show a session-expired toast.
- `PageLogin` reads `location.state.sessionExpired`, shows the toast once with id `session-expired`, clears the auth event, and replaces location state to remove `sessionExpired`.
- Manual logout must not show the session-expired toast.
- Network failure during login should show only the global network toast, not the local invalid-credentials toast.

## Session Expired Event

Session expiration is an explicit event stored in React Query under:

```ts
['auth', 'session-expired']
```

The event shape is:

```ts
type AuthSessionExpiredEvent = {
   reason:
      | 'INVALID_ACCESS_TOKEN'
      | 'INVALID_REFRESH_TOKEN'
      | 'REFRESH_TOKEN_EXPIRED'
   occurredAt: number
}
```

Flow:

```txt
auth interceptor detects invalid/expired auth
onAuthSessionExpired(reason)
setQueryData(['session'], null)
setQueryData(['auth', 'session-expired'], event)
rawApi.post('/auth/logout') clears the HttpOnly refresh cookie
RequireAuth redirects to /login with sessionExpired=true
PageLogin shows one toast and clears the event/state
```

`NETWORK` is not a session-expired reason. It shows the global connectivity toast and rejects the request.

`INVALID_REFRESH_TOKEN` is treated as an invalid/suspicious auth state and expires the session immediately. `REFRESH_TOKEN_EXPIRED` also expires the session. `MISSING_ACCESS_TOKEN` by itself is not shown to the user; it triggers the refresh path so a valid refresh cookie can recover the session.
