import { compare } from 'bcryptjs'
import type { User } from '../models'
import type { DatabaseService } from '../services/database-service'
import type { LoginSchemaRequest } from './auth-interface'

export class AuthService {
   private dbService: DatabaseService

   constructor(dbService: DatabaseService) {
      this.dbService = dbService
   }

   async makeLogin({ email, password }: LoginSchemaRequest): Promise<User> {
      const db = await this.dbService.readDatabase()

      const user = db.users.find((u) => u.email === email)
      if (!user) {
         throw new Error('InvalidCredentials')
      }

      const passwordMatch = await compare(password, user.passwordHash)
      if (!passwordMatch) {
         throw new Error('InvalidCredentials')
      }

      return user
   }

   async findById(id: string): Promise<User | undefined> {
      const db = await this.dbService.readDatabase()
      return db.users.find((u) => u.id === id)
   }
}
