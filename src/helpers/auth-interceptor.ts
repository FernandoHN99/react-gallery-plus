import type {
   AxiosError,
   AxiosInstance,
   InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'
import {
   clearAccessToken,
   getAccessToken,
   setAccessToken,
} from '../contexts/auth/services/access-token-store'
import {
   type AuthErrorReason,
   authErrorHandler,
} from '../contexts/auth/services/auth-error-handler'
import {
   type AuthSessionExpiredReason,
   hasCachedAuthSession,
   onAuthSessionExpired,
} from './auth-events'
import { refreshQueue } from './refresh-queue'

type RetryableRequestConfig = InternalAxiosRequestConfig & {
   _retry?: boolean
}

type SetupAuthInterceptorsParams = {
   api: AxiosInstance
   rawApi: AxiosInstance
}

const NETWORK_ERROR_MESSAGE =
   'Não foi possível conectar ao servidor. Verifique sua conexão.'

export function setupAuthInterceptors({
   api,
   rawApi,
}: SetupAuthInterceptorsParams) {
   api.interceptors.request.use((config) => {
      const token = getAccessToken()

      if (token) {
         config.headers.Authorization = `Bearer ${token}`
      }

      return config
   })

   api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
         const reason = authErrorHandler.getReason(error)

         switch (reason) {
            case 'TOKEN_EXPIRED':
            case 'MISSING_ACCESS_TOKEN': {
               const originalRequest = error.config as
                  | RetryableRequestConfig
                  | undefined

               if (!canRetryWithRefresh(originalRequest)) {
                  return Promise.reject(error)
               }

               try {
                  return await retryWithRefresh(originalRequest)
               } catch (refreshError) {
                  return handleRefreshFailure(refreshError, reason)
               }
            }

            case 'INVALID_ACCESS_TOKEN':
               return expireSession(error, reason)

            case 'INVALID_REFRESH_TOKEN':
            case 'REFRESH_TOKEN_EXPIRED': {
               if (isRefreshRequest(error)) {
                  return Promise.reject(error)
               }

               return expireSession(error, reason)
            }

            case 'NETWORK':
               return rejectNetworkError(error)

            default:
               return Promise.reject(error)
         }
      },
   )

   async function retryWithRefresh(originalRequest: RetryableRequestConfig) {
      originalRequest._retry = true

      const token = await refreshQueue.waitForRefresh(refreshAccessToken)

      setAccessToken(token)
      originalRequest.headers.Authorization = `Bearer ${token}`

      return api.request(originalRequest)
   }

   async function refreshAccessToken() {
      const { data } = await rawApi.post<{ token: string }>('/auth/refresh')

      return data.token
   }

   function handleRefreshFailure(
      error: unknown,
      originalReason: AuthErrorReason,
   ) {
      clearAccessToken()

      const refreshReason = authErrorHandler.getReason(error)

      if (refreshReason === 'NETWORK') {
         return rejectNetworkError(error)
      }

      if (
         shouldExpireSessionAfterRefreshFailure(originalReason, refreshReason)
      ) {
         return expireSession(error, refreshReason)
      }

      return Promise.reject(error)
   }

   async function expireSession(
      error: unknown,
      reason: AuthSessionExpiredReason,
   ) {
      clearAccessToken()
      onAuthSessionExpired(reason)

      try {
         await clearRefreshTokenCookie()
      } catch {
         // Local logout still wins; the cookie can only be removed by the server.
      }

      return Promise.reject(error)
   }

   async function clearRefreshTokenCookie() {
      await rawApi.post('/auth/logout')
   }
}

function shouldExpireSessionAfterRefreshFailure(
   originalReason: AuthErrorReason,
   refreshReason: AuthErrorReason,
): refreshReason is AuthSessionExpiredReason {
   if (refreshReason === 'REFRESH_TOKEN_EXPIRED') return true

   return (
      refreshReason === 'INVALID_REFRESH_TOKEN' &&
      (originalReason === 'TOKEN_EXPIRED' || hasCachedAuthSession())
   )
}

function canRetryWithRefresh(
   request: RetryableRequestConfig | undefined,
): request is RetryableRequestConfig {
   return Boolean(request && !request._retry && !isRefreshCall(request))
}

function isRefreshRequest(error: AxiosError) {
   const request = error.config as RetryableRequestConfig | undefined

   return Boolean(request && isRefreshCall(request))
}

function rejectNetworkError(error: unknown) {
   toast.error(NETWORK_ERROR_MESSAGE)

   return Promise.reject(error)
}

function isRefreshCall(request: RetryableRequestConfig) {
   return request.url?.includes('/auth/refresh') ?? false
}
