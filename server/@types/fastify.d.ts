import '@fastify/jwt'

declare module 'fastify' {
   interface FastifyRequest {
      accessJwtVerify(
         payload: unknown,
         options?: import('@fastify/jwt').FastifyJwtVerifyOptions,
      ): Promise<void>
      refreshJwtVerify(
         payload: unknown,
         options?: import('@fastify/jwt').FastifyJwtVerifyOptions,
      ): Promise<void>

      user: unknown
   }

   interface FastifyInstance {
      jwt: {
         access: import('@fastify/jwt').JWT
         refresh: import('@fastify/jwt').JWT
      }
   }

   interface FastifyReply {
      accessJwtSign(
         payload: unknown,
         options?: import('@fastify/jwt').FastifyJwtSignOptions,
      ): Promise<string>
      refreshJwtSign(
         payload: unknown,
         options?: import('@fastify/jwt').FastifyJwtSignOptions,
      ): Promise<string>
   }
}
