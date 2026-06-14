# Backend

## Scope

This file documents `server/` and its subdirectories, except where a deeper `AGENTS.md` applies.

## Runtime

- Fastify runs on port `5799`.
- `pnpm dev-server` watches and runs `server/dist/main.js` after each `tsup` build.
- `pnpm build-server` runs `tsc --noEmit -p tsconfig.server.json` and then bundles with `tsup`.
- `tsconfig.server.json` is separate from frontend tsconfigs and uses Node-style module resolution, not Vite bundler resolution.

## Data And Files

- Persistent data is stored as JSON through `DatabaseService`.
- Uploaded image files live under `data/images/`.
- Static images are served from `/images/`.

## Architecture

- `server/main.ts` wires Fastify plugins, services, static files, and route modules.
- Domain route folders such as `auth/`, `photos/`, and `albums/` own their route and service code.
- Do not return sensitive user fields such as `passwordHash` from API responses.

## Validation

Use `pnpm build-server` for backend type validation. The root `pnpm build` also runs the server build before the frontend build.
