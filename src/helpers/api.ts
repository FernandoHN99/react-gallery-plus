import axios, { type AxiosRequestConfig } from 'axios'
import { setupAuthInterceptors } from './auth-interceptor'

const apiConfig = {
   baseURL: import.meta.env.VITE_API_URL,
   withCredentials: true,
}

export const api = axios.create({
   ...apiConfig,
})

export const rawApi = axios.create({
   ...apiConfig,
})

setupAuthInterceptors({ api, rawApi })

export const fetcher = (url: string, options: AxiosRequestConfig = {}) =>
   api.get(url, options).then((res) => res.data)
