# Frontend Helpers

## Scope

This file documents `src/helpers/`.

## HTTP Clients

`api.ts` owns the shared Axios setup:

- `api`: normal Axios client with auth interceptors.
- `rawApi`: Axios client with the same base config but no interceptors.
- `fetcher`: `api.get(...).then((res) => res.data)` for React Query reads.

Both clients use `baseURL: import.meta.env.VITE_API_URL` and `withCredentials: true`.

Use `api` for normal application requests. Use `rawApi` only when the request must bypass interceptors, currently `/auth/refresh` and `/auth/logout`, to avoid refresh/logout loops.

## Auth Interceptor

`auth-interceptor.ts` owns request auth, response retry, session expiration, and global network feedback.

Request interceptor:

- Reads the in-memory access token from `access-token-store.ts`.
- Adds `Authorization: Bearer <token>` when a token exists.

Response interceptor:

- Classifies errors with `authErrorHandler.getReason(error)`.
- For `TOKEN_EXPIRED` and `MISSING_ACCESS_TOKEN`, retries once through refresh when the original request is retryable.
- Uses `_retry` on the original Axios request to prevent infinite loops.
- Never retries the refresh request itself.
- On successful refresh, stores the new access token, patches the original `Authorization` header, and replays the original request.
- On `INVALID_ACCESS_TOKEN` or `INVALID_REFRESH_TOKEN`, expires the session immediately.
- On `REFRESH_TOKEN_EXPIRED`, expires the session unless the error is from the refresh call itself.
- On `NETWORK`, shows the global connectivity toast and rejects the error.

Network errors must not be converted into credential errors. UI code that also catches a request error should skip local error toasts when `authErrorHandler.getReason(error) === 'NETWORK'`.

## Refresh Queue

`refresh-queue.ts` is a generic singleton queue. It does not import Axios or auth modules.

- `waitForRefresh(refreshAccessToken)` returns the existing refresh promise when one is already running.
- Only one refresh request should run at a time, even when multiple requests fail simultaneously.
- The queue clears its promise in `finally`, whether refresh succeeds or fails.

## Session Expired Event

`auth-events.ts` bridges code outside React, especially the interceptor, to the React Query cache.

- `registerQueryClient(queryClient)` is called in `src/App.tsx` before rendering providers.
- `onAuthSessionExpired(reason)` sets `['session']` to `null` and writes an event to `['auth', 'session-expired']`.
- `clearAuthSessionExpired()` removes the session-expired event.

The interceptor does not navigate. It records auth state and events; route components decide navigation.
