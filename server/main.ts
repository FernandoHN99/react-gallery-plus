import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import fastifyCookie from '@fastify/cookie'
import fastifyJwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import Fastify from 'fastify'
import { albumsRoutes } from './albums/albums-routes'
import { AlbumsService } from './albums/albums-service'
import { authRoutes } from './auth/auth-routes'
import { AuthService } from './auth/auth-services'
import { env } from './env'
import { photosRoutes } from './photos/photos-routes'
import { PhotosService } from './photos/photos-service'
import { DatabaseService } from './services/database-service'
import { ImageService } from './services/image-service'

const start = async () => {
   const port = Number(process.env.PORT) || 5799
   const imagesDir = resolve(process.cwd(), 'data', 'images')

   const fastify = Fastify({
      logger: true,
   })

   // Se quiser fazer somente uma assinatura para acess token e refresh
   // await fastify.register(fastifyJwt, {
   //    secret: env.JWT_SECRET,
   //    cookie: {
   //       cookieName: 'refreshToken',
   //       signed: false,
   //    },
   //    sign: {
   //       expiresIn: '10s',
   //    },
   // })

   await fastify.register(fastifyJwt, {
      secret: env.JWT_ACCESS_SECRET,
      namespace: 'access',
      sign: { expiresIn: '15m' },
   })

   await fastify.register(fastifyJwt, {
      secret: env.JWT_REFRESH_SECRET,
      namespace: 'refresh',
      cookie: { cookieName: 'refreshToken', signed: false },
      sign: { expiresIn: '7d' },
   })
   await fastify.register(fastifyCookie)

   await fastify.register(import('@fastify/cors'), {
      credentials: true,
      // origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
      origin: (origin, cb) => {
         if (!origin) {
            cb(new Error('Origin must be provided'), false)
            return
         }

         cb(null, true)
      },
      methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
   })

   // Register multipart for file uploads
   await fastify.register(multipart, {
      limits: {
         fileSize: 50 * 1024 * 1024, // 50MB
      },
   })

   await mkdir(imagesDir, { recursive: true })

   // Serve static images
   await fastify.register(staticFiles, {
      root: imagesDir,
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
      await fastify.listen({ port, host: '0.0.0.0' })
      console.log(`🚀 Server running at http://localhost:${port}`)
      console.log(`📁 Images served at http://localhost:${port}/images/`)
      console.log(`🏥 Health check at http://localhost:${port}/health`)
      console.log(`📂 Data directory: ${resolve(process.cwd(), 'data')}`)
   } catch (err) {
      fastify.log.error(err)
      process.exit(1)
   }
}

start()
