import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import { authErrorHandler } from '../contexts/auth/services/auth-error-handler'
import {
   clearAccessToken,
   getAccessToken,
   setAccessToken,
} from '../contexts/auth/services/auth-service'
import { refreshQueue } from './refresh-queue'

export const api = axios.create({
   baseURL: import.meta.env.VITE_API_URL,
   withCredentials: true,
})

export const fetcher = (url: string, options: AxiosRequestConfig = {}) =>
   api.get(url, options).then((res) => res.data)

// ============ REQUEST INTERCEPTOR ============
api.interceptors.request.use((config) => {
   const token = getAccessToken()
   if (token) {
      config.headers.Authorization = `Bearer ${token}`
   }
   return config
})

// ============ RESPONSE INTERCEPTOR ============
api.interceptors.response.use(
   (response) => response,
   async (error: AxiosError) => {
      const originalRequest = error.config
      const { status } = error.response || {}

      // Flag para evitar retry infinito da mesma request
      const alreadyRetried = originalRequest?._retry
      const isRefreshCall = originalRequest?.url?.includes('/auth/refresh')

      // === CASO: 401 TOKEN_EXPIRED (não vindo de /auth/refresh, primeira tentativa) ===
      if (
         status === 401 &&
         authErrorHandler.isTokenExpired(error) &&
         !isRefreshCall &&
         !alreadyRetried
      ) {
         try {
            // Marca como retentada para evitar retry duplicado
            ;(originalRequest as any)._retry = true

            // Aguarda fila de refresh (pode ser uma request anterior já refazendo)
            const newToken = await refreshQueue.waitForRefresh()

            // Atualiza token em memória
            setAccessToken(newToken)

            // Refaz request original com novo token
            originalRequest!.headers.Authorization = `Bearer ${newToken}`
            return api.request(originalRequest!)
         } catch (refreshError) {
            // === Refresh falhou ===

            // Limpa token em memória de qualquer forma
            clearAccessToken()

            // Se for erro de rede/timeout/5xx: mostra toast
            // Se for 401 (REFRESH_TOKEN_EXPIRED/INVALID): rejeita silenciosamente
            // (React Query vai tratar com isRefetchError)
            if (authErrorHandler.isNetworkError(refreshError)) {
               toast.error(
                  'Não foi possível renovar sua sessão. Verifique sua conexão.',
               )
            }

            return Promise.reject(refreshError)
         }
      }

      // === Qualquer outro erro (não 401, ou 401 já retentado, ou erro em /auth/refresh) ===
      return Promise.reject(error)
   },
)
