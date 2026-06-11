import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import Fastify from 'fastify'
import { resolve } from 'path'
import { albumsRoutes } from './albums/albums-routes'
import { AlbumsService } from './albums/albums-service'
import { authRoutes } from './auth/auth-routes'
import { AuthService } from './auth/auth-services'
import { env } from './env'
import { photosRoutes } from './photos/photos-routes'
import { PhotosService } from './photos/photos-service'
import { DatabaseService } from './services/database-service'
import { ImageService } from './services/image-service'

// Start server
const start = async () => {
   const fastify = Fastify({
      logger: true,
   })

   await fastify.register(fastifyJwt, {
      secret: env.JWT_SECRET,
      // cookie: {
      //    cookieName: 'refreshToken',
      //    signed: false,
      // },
      // expiresIn é o tempo de expiração do token, assim quando o token de autenticação é emitido dentro dele é salvo a data de emissão
      // e portanto quando o backend for acessado novamente, ele verifica se o token está dentro do tempo de expiração no caso 10 minutos
      sign: {
         expiresIn: '10m',
      },
   })
   await fastify.register(fastifyCookie)

   await fastify.register(import('@fastify/cors'), {
      credentials: true,
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      //   origin: (origin, cb) => {
      //      if (!origin) {
      //         cb(new Error('Origin must be provided'), false)
      //         return
      //      }

      //      cb(null, true)
      //   },
      methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
   })

   // Register multipart for file uploads
   await fastify.register(multipart, {
      limits: {
         fileSize: 50 * 1024 * 1024, // 50MB
      },
   })

   // Serve static images
   await fastify.register(staticFiles, {
      root: resolve(process.cwd(), 'data', 'images'),
      prefix: '/images/',
   })

   // Initialize services
   const databaseService = new DatabaseService()
   await databaseService.initialize()

   const imageService = new ImageService()
   const photosService = new PhotosService(databaseService, imageService)
   const albumsService = new AlbumsService(databaseService)
   const authService = new AuthService(databaseService)

   // Register routes
   await authRoutes(fastify, authService)
   await photosRoutes(fastify, photosService)
   await albumsRoutes(fastify, albumsService)

   // Health check endpoint
   fastify.get('/health', async (_, reply) => {
      reply.send({ status: 'ok', timestamp: new Date().toISOString() })
   })

   try {
      await fastify.listen({ port: 5799, host: '0.0.0.0' })
      console.log('🚀 Server running at http://localhost:5799')
      console.log('📁 Images served at http://localhost:5799/images/')
      console.log('🏥 Health check at http://localhost:5799/health')
      console.log(`📂 Data directory: ${resolve(process.cwd(), 'data')}`)
   } catch (err) {
      fastify.log.error(err)
      process.exit(1)
   }
}

start()
