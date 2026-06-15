import type { FastifyInstance } from 'fastify'
import { loginSchema } from './auth-interface'
import type { AuthService } from './auth-services'
import { verifyJwtAccessToken, verifyJwtRefreshToken } from './verify-jwt'

export async function authRoutes(
   fastify: FastifyInstance,
   authService: AuthService,
) {
   const isProduction =
      process.env.NODE_ENV === 'production' || process.env.RENDER === 'true'
   const refreshCookieOptions = {
      path: '/',
      sameSite: isProduction ? ('none' as const) : ('lax' as const),
      secure: isProduction,
   }

   // POST /auth/login
   fastify.post('/auth/login', async (request, reply) => {
      const body = loginSchema.safeParse(request.body)
      if (!body.success) {
         return reply.status(400).send({ message: body.error.issues })
      }

      try {
         const user = await authService.makeLogin(body.data)
         const token = await reply.accessJwtSign({}, { sign: { sub: user.id } })
         const refreshToken = await reply.refreshJwtSign(
            {},
            { sign: { sub: user.id } }, // se quiser sobreescrever o tempo:  { sign: { sub: user.id, expiresIn: '30d' } },
         )

         return reply
            .setCookie('refreshToken', refreshToken, {
               ...refreshCookieOptions,
               httpOnly: true,
               maxAge: 7 * 24 * 60 * 60,
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
   fastify.post(
      '/auth/refresh',
      { onRequest: [verifyJwtRefreshToken] },
      async (request, reply) => {
         const sub = (request.user as { sub: string }).sub

         const user = await authService.findById(sub)
         if (!user) {
            return reply.status(401).send({
               code: 'INVALID_REFRESH_TOKEN',
               message: 'Usuário não encontrado',
            })
         }

         const token = await reply.accessJwtSign({}, { sign: { sub: user.id } })

         return reply.status(200).send({ token })
      },
   )

   // POST /auth/logout
   fastify.post('/auth/logout', async (_, reply) => {
      return reply
         .clearCookie('refreshToken', refreshCookieOptions)
         .status(204)
         .send()
   })

   // GET /auth/me
   fastify.get(
      '/auth/me',
      { onRequest: [verifyJwtAccessToken] },
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
