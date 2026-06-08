import { api } from '../../../helpers/api'
import type { User } from '../models/user'
export const MOCK_CREDENTIALS = {
   email: 'admin@gallery.com',
   password: '123456',
}

let accessToken: string | null = null

async function fetchMe(): Promise<User> {
   const { data } = await api.get<User>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
   })
   return data
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
         const { data } = await api.post<{ token: string }>('/auth/refresh')
         accessToken = data.token
      }
      return fetchMe()
   },

   async logout(): Promise<void> {
      accessToken = null
      await api.post('/auth/logout')
   },
}
