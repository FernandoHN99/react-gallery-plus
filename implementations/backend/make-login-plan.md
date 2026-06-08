# Plano: makeLogin — Backend

## Escopo

Somente a funcionalidade de login. Sem registro de usuário neste plano.

---

## Problema atual em `auth-services.ts`

```ts
// ERRADO — hash gera um novo hash a cada chamada, nunca vai ser igual ao salvo
const passwordHash = await hash(password, 6)
const userDB = db.users.find(
  (u) => u.email === email && u.passwordHash === passwordHash,
)
```

`hash()` do bcryptjs é não-determinístico (salt aleatório a cada chamada).
Para verificar a senha contra o hash salvo deve-se usar `compare()`.

---

## Arquivos a alterar

### 1. `server/auth/auth-services.ts`

**Problema:** `makeLogin` é `private` e usa `hash` em vez de `compare`.  
**Correção:**

- Trocar `hash` por `compare`
- Mudar para `public` (precisa ser chamado pela rota)
- Lançar erro explícito se o usuário não for encontrado ou senha errada
- Retornar o `user` encontrado para que a rota gere o JWT

```ts
import { compare } from 'bcryptjs'
import type { User } from '../models'
import type { DatabaseService } from '../services/database-service'
import type { LoginSchemaRequest } from './auth-interface'

export class AuthService {
  constructor(private dbService: DatabaseService) {}

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
}
```

**Motivo de um único erro genérico `InvalidCredentials`:**
não revelar se o e-mail existe ou não (segurança).

---

### 2. `server/auth/auth-routes.ts`

**Criar** a função `authRoutes` com `POST /auth/login`:

- Validar body com `loginSchema` (já existe em `auth-interface.ts`)
- Chamar `authService.makeLogin()`
- Em caso de sucesso:
  - Gerar `token` de acesso (10m) via `reply.jwtSign({ sub: user.id })`
  - Gerar `refreshToken` (7d) via `reply.jwtSign({ sub: user.id, expiresIn: '7d' })`
  - Setar `refreshToken` como cookie `httpOnly`
  - Retornar `{ token }` com status 200
- Em caso de `InvalidCredentials`: retornar 401

```ts
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
      return reply.status(400).send({ message: body.error.issues[0].message })
    }

    try {
      const user = await authService.makeLogin(body.data)

      const token = await reply.jwtSign(
        {},
        { sign: { sub: user.id } },
      )

      const refreshToken = await reply.jwtSign(
        {},
        { sign: { sub: user.id, expiresIn: '7d' } },
      )

      return reply
        .setCookie('refreshToken', refreshToken, {
          path: '/',
          sameSite: true,
          httpOnly: true,
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
```

---

### 3. `server/main.ts`

**Adicionar** instância de `AuthService` e registro de `authRoutes`:

```ts
import { AuthService } from './auth/auth-services'
import { authRoutes } from './auth/auth-routes'

// dentro do start(), após databaseService.initialize():
const authService = new AuthService(databaseService)
await authRoutes(fastify, authService)
```

---

## Fluxo completo do login

```
POST /auth/login  { email, password }
  └─> loginSchema.safeParse()         — valida formato
        └─> authService.makeLogin()
              ├─> busca user por email no db.json
              ├─> bcrypt.compare(password, user.passwordHash)
              └─> retorna User
                    └─> reply.jwtSign() — token 10m
                    └─> reply.jwtSign() — refreshToken 7d → cookie httpOnly
                    └─> { token }  ← resposta ao cliente
```

---

## Pré-requisito: usuário no db.json

O `db.json` precisa ter ao menos um usuário com a senha já em hash bcrypt.
Isso deve ser feito manualmente ou via script de seed.

Exemplo de entrada no `data/db.json`:

```json
"users": [
  {
    "id": "1",
    "email": "admin@gallery.com",
    "passwordHash": "$2a$06$...",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

## Checklist

- [ ] Corrigir `makeLogin` em `auth-services.ts` (`compare` em vez de `hash`, `public`)
- [ ] Criar `authRoutes` em `auth-routes.ts`
- [ ] Registrar `AuthService` e `authRoutes` em `main.ts`
- [ ] Verificar tipos com `pnpm build-server`
