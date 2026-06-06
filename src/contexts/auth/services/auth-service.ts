import type { User } from '../models/user'

const TOKEN_KEY = 'gallery_plus_token'
const MOCK_USER: User = { id: '1', name: 'Admin', email: 'admin@gallery.com' }
export const MOCK_CREDENTIALS = { email: 'admin@gallery.com', password: '123456' }

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const authService = {
   async login(email: string, password: string): Promise<User> {
      await delay(600)
      if (email !== MOCK_CREDENTIALS.email || password !== MOCK_CREDENTIALS.password) {
         throw new Error('E-mail ou senha inválidos')
      }
      localStorage.setItem(TOKEN_KEY, JSON.stringify(MOCK_USER))
      return MOCK_USER
   },

   async getSession(): Promise<User> {
      await delay(300)
      const stored = localStorage.getItem(TOKEN_KEY)
      if (!stored) throw new Error('Sessão não encontrada')
      return JSON.parse(stored) as User
   },

   async logout(): Promise<void> {
      await delay(200)
      localStorage.removeItem(TOKEN_KEY)
   },
}
