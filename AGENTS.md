# AGENTS.md

## Commands

```bash
pnpm dev            # frontend — http://localhost:5173
pnpm dev-server     # backend watch — http://localhost:5799 (must run separately)
pnpm build          # runs build-server first, then vite build
pnpm build-server   # tsc typecheck (tsconfig.server.json) + tsup bundle
pnpm lint           # ESLint
```

No test suite. No typecheck script — type errors surface via `build-server` (server) or Vite build (frontend).

## Environment

Copy `.env.example` → `.env`. Two vars required:
```
VITE_API_URL=http://localhost:5799
VITE_IMAGES_URL=http://localhost:5799/images
```
Frontend and backend must run concurrently — frontend has no fallback/mock.

## Architecture

Full-stack monorepo. Frontend (Vite/React) and backend (Fastify) share the same `package.json`.

**Backend** (`server/`):
- Fastify on port 5799, built with `tsup` → `server/dist/main.js`
- JSON file database via `DatabaseService`; images stored in `data/images/`
- Static files served at `/images/` from `data/images/`
- `tsconfig.server.json` is separate from the frontend tsconfigs — `moduleResolution: node`, not `bundler`

**Frontend** (`src/`):
- Domain split: `src/contexts/photos/` and `src/contexts/albums/`
- Each context has `models/`, `hooks/`, `components/`
- Shared Zod schemas: `src/contexts/schemas.ts` (`photoNewFormSchema`, `photoEditSchema`)
- Album-local schemas: `src/contexts/albums/schemas.ts`
- HTTP client: `src/helpers/api.ts` — Axios instance (`api`) + `fetcher` helper for React Query

**Routing** (in `src/App.tsx`):
- `/` → `PageHome`
- `/fotos/:id` → `PagePhotoDetails`
- `/componentes` → `PageComponents`

## Patterns

**Mutations — always `useMutation`, never `useTransition`:**
All async write operations (create, update, delete, manage albums) use `useMutation` from TanStack Query.
- `mutationFn` holds the API call(s)
- `onSuccess` handles `invalidateQueries` + `toast.success`
- `onError` handles `toast.error`
- `mutation.isPending` drives disabled/loading UI states
- `mutateAsync` is used when the caller needs to await (e.g. closing a modal after save)
- `mutate` is used for fire-and-forget (e.g. delete)

**`managePhotoOnAlbumMutation`** (`use-photo-albums.ts`):
- `mutationFn` receives `{ photoId, albumsIds }` (single object, not two args)
- Used by `use-photo.ts`, `use-album.ts`, and `albums-list-selectable.tsx`

**`invalidateQueries` vs `setQueryData`:**
- This project uses `invalidateQueries` (refetch from server) — not optimistic updates

**Validation:**
- Forms use React Hook Form + `zodResolver`
- Inline field errors derived from `safeParse` (not separate state)
- `photoEditSchema` has both `title` (min 1, max 255) and `albumsIds` (required array)

## Formatter

Biome is the formatter and secondary linter (3-space indent, single quotes, no semicolons, trailing commas).
ESLint handles React-specific rules. Both are active — run `pnpm lint` for ESLint; Biome runs via editor/CI.

Biome ignores `src/components/ui/`.

## Important Constraints

**🚫 NEVER commit without user authorization.**
- Stage files as needed
- Show user the changes with `git diff` or `git status`
- Wait for explicit approval before running `git commit`
- If you've already committed, immediately undo with `git reset --soft HEAD~1` and `git reset HEAD`
