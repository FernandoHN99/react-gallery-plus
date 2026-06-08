import type { FastifyInstance } from 'fastify'
import { loginSchema } from './auth-interface'
import type { AuthService } from './auth-services'
import { verifyJwt } from './verify-jwt'

export async function authRoutes(
   fastify: FastifyInstance,
   authService: AuthService,
) {
   // POST /auth/login
   fastify.post('/auth/login', async (request, reply) => {
      const body = loginSchema.safeParse(request.body)
      if (!body.success) {
         return reply.status(400).send({ message: body.error.issues })
      }

      try {
         const user = await authService.makeLogin(body.data)

         const token = await reply.jwtSign({}, { sign: { sub: user.id } })

         const refreshToken = await reply.jwtSign(
            {},
            { sign: { sub: user.id, expiresIn: '7d' } },
         )

         return reply
            .setCookie('refreshToken', refreshToken, {
               path: '/',
               sameSite: true,
               httpOnly: true,
               maxAge: 7 * 60 * 60 * 24,
            })
            .status(200)
            .send({ token })
      } catch (err) {
         if (err instanceof Error && err.message === 'InvalidCredentials') {
            return reply.status(401).send({ message: 'Credenciais inválidas.' })
         }
         throw err
      }
   })

   // POST /auth/refresh
   fastify.post('/auth/refresh', async (request, reply) => {
      try {
         await request.jwtVerify({ onlyCookie: true })

         const sub = (request.user as { sub: string }).sub

         const user = await authService.findById(sub)
         if (!user) {
            return reply.status(401).send({ message: 'Unauthorized.' })
         }

         const token = await reply.jwtSign({}, { sign: { sub: user.id } })

         return reply.status(200).send({ token })
      } catch {
         return reply.status(401).send({ message: 'Unauthorized.' })
      }
   })

   // POST /auth/logout
   fastify.post('/auth/logout', async (_, reply) => {
      return reply.clearCookie('refreshToken', { path: '/' }).status(204).send()
   })

   // GET /auth/me
   fastify.get(
      '/auth/me',
      { onRequest: [verifyJwt] },
      async (request, reply) => {
         const sub = (request.user as { sub: string }).sub

         const user = await authService.findById(sub)
         if (!user) {
            return reply
               .status(404)
               .send({ message: 'Usuário não encontrado.' })
         }

         return reply.status(200).send({ id: user.id, email: user.email })
      },
   )
}
