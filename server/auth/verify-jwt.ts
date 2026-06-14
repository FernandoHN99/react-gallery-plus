import type { FastifyReply, FastifyRequest } from 'fastify'

export async function verifyJwtAccessToken(
   request: FastifyRequest,
   reply: FastifyReply,
) {
   if (!request.headers.authorization) {
      return reply.status(401).send({
         code: 'MISSING_ACCESS_TOKEN',
         message: 'Access token não informado',
      })
   }
   try {
      await request.accessJwtVerify({ onlyCookie: false })
   } catch (error) {
      if (
         error instanceof Error &&
         error.message.toUpperCase().includes('EXPIRED')
      ) {
         return reply.status(401).send({
            code: 'TOKEN_EXPIRED',
            message: 'Access token expirado',
         })
      }
      return reply.status(401).send({
         code: 'INVALID_ACCESS_TOKEN',
         message: 'Access token inválido',
      })
   }
}

export async function verifyJwtRefreshToken(
   request: FastifyRequest,
   reply: FastifyReply,
) {
   try {
      await request.refreshJwtVerify({ onlyCookie: true })
   } catch (error) {
      if (
         error instanceof Error &&
         error.message.toUpperCase().includes('EXPIRED')
      ) {
         return reply.status(401).send({
            code: 'REFRESH_TOKEN_EXPIRED',
            message: 'Refresh token expirado. Faça login novamente.',
         })
      }

      // Qualquer outro erro de JWT (malformado, inválido, etc)
      return reply.status(401).send({
         code: 'INVALID_REFRESH_TOKEN',
         message: 'Refresh token inválido',
      })
   }
}
