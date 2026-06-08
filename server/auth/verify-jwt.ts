import type { FastifyReply, FastifyRequest } from 'fastify'

export async function verifyJwt(request: FastifyRequest, reply: FastifyReply) {
   try {
      // A função jwtVerify() verifica se o token JWT é válido e
      // Retorna as informações principais do payload contida no token dentro da propriedade (chave) "user"
      // A própria função jwtVerify() já lança um erro caso o token seja inválido
      await request.jwtVerify()
   } catch {
      return reply.status(401).send({ message: 'Unauthorized.' })
   }
}
