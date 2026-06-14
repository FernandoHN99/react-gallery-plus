import type { User } from '../models/user'
import { clearAccessToken, setAccessToken } from './access-token-store'
import { fetchMeRequest, loginRequest, logoutRequest } from './auth-api'

export const MOCK_CREDENTIALS = {
   email: 'admin@gallery.com',
   password: '123456',
}

async function fetchMe(): Promise<User> {
   try {
      return await fetchMeRequest()
   } catch (error) {
      clearAccessToken()
      throw error
   }
}

export const authService = {
   async login(email: string, password: string): Promise<User> {
      const { token } = await loginRequest(email, password)
      setAccessToken(token)

      return fetchMe()
   },

   async getSession(): Promise<User> {
      return fetchMe()
   },

   async logout(): Promise<void> {
      clearAccessToken()
      await logoutRequest()
   },
}
