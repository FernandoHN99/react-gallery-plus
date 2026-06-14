# Backend Auth

## Scope

This file documents `server/auth/`.

## Auth Service

- `AuthService.makeLogin()` validates existing users only. There is no registration flow.
- Password validation must use `bcrypt.compare(password, user.passwordHash)`. Never validate by hashing the submitted password again; bcrypt salts make `hash()` non-deterministic.
- Login failures should throw/use one generic `InvalidCredentials` error so the API does not reveal whether the email exists.
- `AuthService.findById()` reads users from the JSON database for `/auth/refresh` and `/auth/me`.

## Routes

- `POST /auth/login` validates the body with `loginSchema`, calls `makeLogin()`, signs an access token, signs a refresh token, sets the refresh cookie, and returns `{ token }`.
- `POST /auth/refresh` is protected by `verifyJwtRefreshToken`, reads the authenticated `sub`, validates the user still exists, and returns a new access token.
- `POST /auth/logout` clears the `refreshToken` cookie with `reply.clearCookie('refreshToken', { path: '/' })` and returns `204`.
- `GET /auth/me` is protected by `verifyJwtAccessToken` and returns authenticated user data without `passwordHash`.

## Token Storage Contract

- Access tokens are returned to the frontend and kept in frontend memory.
- Refresh tokens are cookies owned by the backend.
- The `refreshToken` cookie must be `httpOnly`, have `path: '/'`, and be cleared by `/auth/logout`.
- Frontend JavaScript cannot remove the `refreshToken` cookie directly.

## JWT Error Codes

The frontend auth interceptor depends on these exact `code` values:

```txt
MISSING_ACCESS_TOKEN
TOKEN_EXPIRED
INVALID_ACCESS_TOKEN
REFRESH_TOKEN_EXPIRED
INVALID_REFRESH_TOKEN
```

`verifyJwtAccessToken()` returns:

- `MISSING_ACCESS_TOKEN` when there is no `Authorization` header.
- `TOKEN_EXPIRED` when access JWT verification fails because the token expired.
- `INVALID_ACCESS_TOKEN` for malformed or otherwise invalid access tokens.

`verifyJwtRefreshToken()` returns:

- `REFRESH_TOKEN_EXPIRED` when the refresh JWT cookie expired.
- `INVALID_REFRESH_TOKEN` for missing, malformed, invalid, or otherwise untrusted refresh tokens.

Treat `INVALID_REFRESH_TOKEN` as a suspicious/invalid auth state. The frontend expires the session immediately when it sees this code.

## Seed Data

The JSON database must contain at least one user with a bcrypt-hashed password for login to succeed. The frontend displays the demo credentials `admin@gallery.com` / `123456`, so the backend data should stay aligned with that demo account when using the local app.
