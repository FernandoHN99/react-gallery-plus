# Frontend

## Scope

This file documents `src/` and its subdirectories, except where a deeper `AGENTS.md` applies.

## App Shell

- The frontend is Vite + React.
- `src/App.tsx` creates the `QueryClient`, registers it with auth events, and renders `QueryClientProvider`, `NuqsAdapter`, `Toaster`, `BrowserRouter`, and routes.
- The `Toaster` from Sonner is mounted at the app level.

## Routing

Routes are defined in `src/App.tsx`:

- `/login` is public and renders `PageLogin`.
- Protected routes are wrapped by `RequireAuth`.
- Protected routes render inside `LayoutMain`.
- `/` renders `PageHome`.
- `/fotos/:id` renders `PagePhotoDetails`.
- `/componentes` renders `PageComponents`.

Use React Router soft navigation (`Navigate`, `useNavigate`) for auth redirects. Do not introduce hard redirects such as `window.location.href` for normal auth flow.
