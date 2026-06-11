import { api, fetcher } from '../../../helpers/api'
import type { User } from '../models/user'
export const MOCK_CREDENTIALS = {
   email: 'admin@gallery.com',
   password: '123456',
}

let accessToken: string | null = null

export function getAccessToken(): string | null {
   return accessToken
}

export function setAccessToken(token: string) {
   accessToken = token
}

async function fetchMe(): Promise<User> {
   try {
      const data = await fetcher('/auth/me')
      return data
   } catch (error) {
      accessToken = null
      throw error
   }
}

export function clearAccessToken() {
   accessToken = null
}

export const authService = {
   async login(email: string, password: string): Promise<User> {
      const { data } = await api.post<{ token: string }>('/auth/login', {
         email,
         password,
      })
      accessToken = data.token
      return fetchMe()
   },

   async getSession(): Promise<User> {
      // O interceptor cuidará do refresh automático se accessToken expirou
      // Aqui apenas retorna a sessão atual
      return fetchMe()
   },

   async logout(): Promise<void> {
      accessToken = null
      await api.post('/auth/logout')
   },
}
