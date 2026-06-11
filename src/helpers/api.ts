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
// Adiciona Authorization header com accessToken
api.interceptors.request.use((config) => {
   const token = getAccessToken()
   if (token) {
      config.headers.Authorization = `Bearer ${token}`
   }
   return config
})

// ============ RESPONSE INTERCEPTOR ============
let isRedirecting = false

api.interceptors.response.use(
   (response) => response,
   async (error: AxiosError) => {
      const { status } = error.response || {}

      // === CASO 1: 401 TOKEN_EXPIRED (não vindo de /auth/refresh) ===
      if (
         status === 401 &&
         authErrorHandler.isTokenExpired(error) &&
         !error.config?.url?.includes('/auth/refresh')
      ) {
         try {
            // Aguarda refresh (fila singleton)
            const newToken = await refreshQueue.waitForRefresh()
            setAccessToken(newToken)

            // Refaz request original com novo token
            if (error.config) {
               error.config.headers.Authorization = `Bearer ${newToken}`
               return api.request(error.config)
            }
         } catch (refreshError) {
            // === Se refresh falhou ===

            if (authErrorHandler.isRefreshTokenInvalid(refreshError)) {
               // Refresh retornou 401 (REFRESH_TOKEN_EXPIRED ou INVALID_REFRESH_TOKEN)
               performLogout()
               toast.error('Sessão expirada. Faça login novamente.')
            } else if (authErrorHandler.isNetworkError(refreshError)) {
               // Erro de rede, timeout, 5xx, etc
               toast.error(
                  'Não foi possível renovar sua sessão. Verifique sua conexão.',
               )
            }

            return Promise.reject(refreshError)
         }
      }

      // === CASO 2: 401 vindo de /auth/refresh (refresh token inválido) ===
      if (status === 401 && error.config?.url?.includes('/auth/refresh')) {
         performLogout()
         toast.error('Sessão expirada. Faça login novamente.')
         return Promise.reject(error)
      }

      // === Qualquer outro erro: passa adiante ===
      return Promise.reject(error)
   },
)

function performLogout() {
   if (isRedirecting) return
   isRedirecting = true
   clearAccessToken()
   sessionStorage.setItem('sessionExpired', 'true')
   window.location.href = '/login'
}
