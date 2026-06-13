import axios, {
   type AxiosError,
   type AxiosRequestConfig,
   type InternalAxiosRequestConfig,
} from 'axios'
import { toast } from 'sonner'
import {
   type AuthFailure,
   authErrorHandler,
} from '../contexts/auth/services/auth-error-handler'
import {
   clearAccessToken,
   getAccessToken,
   setAccessToken,
} from '../contexts/auth/services/auth-service'
import {
   type AuthSessionExpiredReason,
   hasCachedAuthSession,
   onAuthSessionExpired,
} from './auth-events'
import { refreshQueue } from './refresh-queue'

type RetryableRequestConfig = InternalAxiosRequestConfig & {
   _retry?: boolean
}

const NETWORK_ERROR_MESSAGE =
   'Não foi possível conectar ao servidor. Verifique sua conexão.'

const apiConfig = {
   baseURL: import.meta.env.VITE_API_URL,
   withCredentials: true,
}

const authApi = axios.create(apiConfig)

export const api = axios.create({
   ...apiConfig,
})

export const fetcher = (url: string, options: AxiosRequestConfig = {}) =>
   api.get(url, options).then((res) => res.data)

export async function clearRefreshTokenCookie() {
   await authApi.post('/auth/logout')
}

// ============ REQUEST INTERCEPTOR ============
api.interceptors.request.use((config) => {
   const token = getAccessToken()
   if (token) {
      config.headers.Authorization = `Bearer ${token}`
   }
   return config
})

async function retryWithRefresh(originalRequest: RetryableRequestConfig) {
   originalRequest._retry = true

   const token = await refreshQueue.waitForRefresh()

   setAccessToken(token)
   originalRequest.headers.Authorization = `Bearer ${token}`

   return api.request(originalRequest)
}

function handleRefreshFailure(error: unknown, originalAuthFailure: AuthFailure) {
   clearAccessToken()

   const refreshFailure = authErrorHandler.getAuthFailure(error)

   if (refreshFailure === 'NETWORK') {
      return Promise.reject(error)
   }

   if (shouldExpireSessionAfterRefreshFailure(originalAuthFailure, refreshFailure)) {
      return expireSession(error, refreshFailure)
   }

   return Promise.reject(error)
}

async function expireSession(error: unknown, reason: AuthSessionExpiredReason) {
   clearAccessToken()
   onAuthSessionExpired(reason)

   try {
      await clearRefreshTokenCookie()
   } catch {
      // Local logout still wins; the cookie can only be removed by the server.
   }

   return Promise.reject(error)
}

function shouldExpireSessionAfterRefreshFailure(
   originalAuthFailure: AuthFailure,
   refreshFailure: AuthFailure,
): refreshFailure is AuthSessionExpiredReason {
   if (refreshFailure === 'REFRESH_TOKEN_EXPIRED') return true

   return (
      refreshFailure === 'INVALID_REFRESH_TOKEN' &&
      (originalAuthFailure === 'TOKEN_EXPIRED' || hasCachedAuthSession())
   )
}

function rejectNetworkError(error: unknown) {
   toast.error(NETWORK_ERROR_MESSAGE)

   return Promise.reject(error)
}

function isRefreshCall(request: RetryableRequestConfig) {
   return request.url?.includes('/auth/refresh') ?? false
}

api.interceptors.response.use(
   (response) => response,
   async (error: AxiosError) => {
      const authFailure = authErrorHandler.getAuthFailure(error)

      switch (authFailure) {
         case 'TOKEN_EXPIRED':
         case 'MISSING_ACCESS_TOKEN': {
            const originalRequest = error.config as
               | RetryableRequestConfig
               | undefined

            if (
               !originalRequest ||
               originalRequest._retry ||
               isRefreshCall(originalRequest)
            ) {
               return Promise.reject(error)
            }

            try {
               return await retryWithRefresh(originalRequest)
            } catch (refreshError) {
               return handleRefreshFailure(refreshError, authFailure)
            }
         }

         case 'INVALID_ACCESS_TOKEN':
            return expireSession(error, authFailure)

         case 'INVALID_REFRESH_TOKEN':
         case 'REFRESH_TOKEN_EXPIRED': {
            const originalRequest = error.config as
               | RetryableRequestConfig
               | undefined

            if (originalRequest && isRefreshCall(originalRequest)) {
               return Promise.reject(error)
            }

            return expireSession(error, authFailure)
         }

         case 'NETWORK':
            return rejectNetworkError(error)

         default:
            return Promise.reject(error)
      }
   },
)
