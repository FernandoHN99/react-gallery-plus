# Frontend Contexts

## Scope

This file documents `src/contexts/` and its feature contexts, except where a deeper `AGENTS.md` applies.

## Organization

- Domain code is split by context: `auth/`, `photos/`, and `albums/`.
- Feature contexts use `models/`, `hooks/`, and `components/` when those layers exist.
- Shared photo form schemas live in `src/contexts/schemas.ts`.
- Album-only schemas live in `src/contexts/albums/schemas.ts`.

## Mutations

Use TanStack Query `useMutation` for async write operations. Do not use React `useTransition` for creates, updates, deletes, logout, or relationship management.

Mutation conventions:

- `mutationFn` holds the API call or calls.
- `onSuccess` handles `invalidateQueries`, `setQueryData` when intentionally updating cache state, and success toasts.
- `onError` handles error toasts.
- `mutation.isPending` drives disabled/loading UI.
- Use `mutateAsync` when the caller must await completion, such as closing a modal after save.
- Use `mutate` for fire-and-forget actions, such as delete.

This project generally prefers `invalidateQueries` and refetching from the server over optimistic updates.

## Validation

- Forms use React Hook Form with `zodResolver`.
- Inline field errors should come from validation results such as `safeParse` or form state, not duplicate local state.
- `photoNewFormSchema` validates title, required file input, and optional `albumsIds`.
- `photoEditSchema` requires `photoId`, `title`, and an `albumsIds` array.
- `albumNewFormSchema` validates album title and optional `photosIds`.

## Photo Album Relationship

`managePhotoOnAlbumMutation` in `photos/hooks/use-photo-albums.ts` receives a single object payload:

```ts
{ photoId, albumsIds }
```

Do not change it to multiple positional arguments. This mutation is shared by photo and album flows, including `use-photo.ts`, `use-album.ts`, and `albums-list-selectable.tsx`.
