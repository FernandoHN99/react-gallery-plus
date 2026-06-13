/**
 * Singleton que conecta o QueryClient (fora do React) ao interceptor
 * Permite que o interceptor dispare eventos de sessão expirada
 */

import type { QueryClient } from '@tanstack/react-query'

export type AuthSessionExpiredReason =
   | 'INVALID_ACCESS_TOKEN'
   | 'INVALID_REFRESH_TOKEN'
   | 'REFRESH_TOKEN_EXPIRED'

export type AuthSessionExpiredEvent = {
   reason: AuthSessionExpiredReason
   occurredAt: number
}

export const authSessionExpiredQueryKey = ['auth', 'session-expired'] as const

let queryClient: QueryClient | null = null

export function registerQueryClient(client: QueryClient) {
   queryClient = client
}

/**
 * Chamado pelo interceptor quando a sessão realmente expira.
 * Marca a sessão como morta e registra um evento separado para UI.
 */
export function onAuthSessionExpired(reason: AuthSessionExpiredReason) {
   if (!queryClient) return

   queryClient.setQueryData(['session'], null)
   queryClient.setQueryData<AuthSessionExpiredEvent>(
      authSessionExpiredQueryKey,
      {
         reason,
         occurredAt: Date.now(),
      },
   )
}

export function hasCachedAuthSession() {
   if (!queryClient) return false

   const session = queryClient.getQueryData<{ id?: unknown }>(['session'])

   return Boolean(session?.id)
}

export function clearAuthSessionExpired() {
   if (!queryClient) return

   queryClient.removeQueries({ queryKey: authSessionExpiredQueryKey })
}
