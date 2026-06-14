import { api, fetcher, rawApi } from '../../../helpers/api'
import type { User } from '../models/user'

export async function loginRequest(email: string, password: string) {
   const { data } = await api.post<{ token: string }>('/auth/login', {
      email,
      password,
   })

   return data
}

export async function fetchMeRequest(): Promise<User> {
   return fetcher('/auth/me')
}

export async function logoutRequest(): Promise<void> {
   await rawApi.post('/auth/logout')
}
