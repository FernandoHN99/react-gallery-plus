import { api } from '../../../helpers/api'
import type { User } from '../models/user'
export const MOCK_CREDENTIALS = {
   email: 'admin@gallery.com',
   password: '123456',
}

let accessToken: string | null = null

async function fetchMe(): Promise<User> {
   try {
      const { data } = await api.get<User>('/auth/me', {
         headers: { Authorization: `Bearer ${accessToken}` },
      })
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
      if (!accessToken) {
         try {
            const { data } = await api.post<{ token: string }>('/auth/refresh')
            accessToken = data.token
         } catch (error) {
            accessToken = null
            throw error
         }
      }
      return fetchMe()
   },

   async logout(): Promise<void> {
      accessToken = null
      await api.post('/auth/logout')
   },
}
