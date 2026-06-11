import axios, { type AxiosRequestConfig } from 'axios'
import {
   clearAccessToken,
   getAccessToken,
} from '../contexts/auth/services/auth-service'

export const api = axios.create({
   baseURL: import.meta.env.VITE_API_URL,
   withCredentials: true,
})

export const fetcher = (url: string, options: AxiosRequestConfig = {}) =>
   api.get(url, options).then((res) => res.data)

api.interceptors.request.use((config) => {
   const token = getAccessToken()
   if (token) {
      config.headers.Authorization = `Bearer ${token}`
   }
   return config
})

let isRedirecting = false

api.interceptors.response.use(
   (response) => response,
   (error) => {
      if (error.response?.status === 401 && !isRedirecting) {
         isRedirecting = true
         clearAccessToken()
         sessionStorage.setItem('sessionExpired', 'true')
         window.location.href = '/login'
      }
      return Promise.reject(error)
   },
)
