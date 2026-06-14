# AGENTS.md

## Scope

This file contains global guidance for the whole repository. More specific rules live near the code they describe:

- `server/AGENTS.md`: backend runtime, database, static files, and build details
- `server/auth/AGENTS.md`: backend authentication routes, JWT cookies, and error code contract
- `src/AGENTS.md`: frontend app shell, providers, and routing
- `src/helpers/AGENTS.md`: Axios clients, auth interceptor, refresh queue, and auth events
- `src/contexts/AGENTS.md`: frontend domain context conventions for photos, albums, and shared schemas
- `src/contexts/auth/AGENTS.md`: frontend authentication context, hooks, services, route guard, and login UX

## Commands

```bash
pnpm dev            # frontend, http://localhost:5173
pnpm dev-server     # backend watch, http://localhost:5799; run separately
pnpm build          # runs build-server first, then vite build
pnpm build-server   # tsc typecheck for server + tsup bundle
pnpm lint           # ESLint
```

There is no test suite. There is no standalone typecheck script. Server type errors surface through `pnpm build-server`; frontend type/build errors surface through `pnpm build`.

## Environment

Copy `.env.example` to `.env`. Required variables:

```txt
VITE_API_URL=http://localhost:5799
VITE_IMAGES_URL=http://localhost:5799/images
```

Frontend and backend must run concurrently. The frontend has no fallback/mock API.

## Project Shape

This is a full-stack monorepo. The Vite/React frontend and Fastify backend share the same `package.json`.

Keep documentation modular. Add or update the nearest applicable `AGENTS.md` instead of centralizing module-specific knowledge in this root file.

## Formatter

Biome is the formatter and secondary linter: 3-space indent, single quotes, no semicolons, trailing commas.

ESLint handles React-specific rules. Run `pnpm lint` for ESLint. Biome runs through editor/CI.

Biome ignores `src/components/ui/`.

## Commits

Never commit without explicit user authorization.

Before committing, inspect `git status`, `git diff`, and recent commits. Stage only intended files and do not include unrelated local changes.
