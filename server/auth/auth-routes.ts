import type { FastifyInstance } from 'fastify'
import { loginSchema } from './auth-interface'
import type { AuthService } from './auth-services'

export async function authRoutes(
   fastify: FastifyInstance,
   authService: AuthService,
) {
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
            //    maxAge: 7 * 86400,
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
}
