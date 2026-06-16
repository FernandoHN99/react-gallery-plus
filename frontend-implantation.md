# Plano de implantacao do frontend no Render

## 1. Pre-requisitos

Antes de criar o frontend, o backend precisa estar publicado e acessivel no Render.

Confirme se a rota abaixo esta funcionando:

```txt
https://url-do-backend.onrender.com/health
```

Ela deve retornar algo parecido com:

```json
{
   "status": "ok"
}
```

Guarde a URL base do backend, sem barra no final.

Exemplo:

```txt
https://react-gallery-plus.onrender.com
```

## 2. Criar o Static Site

No Render:

1. Clique em **New**.
2. Selecione **Static Site**.
3. Conecte o repositorio `react-gallery-plus`.
4. Selecione a branch `main`.
5. Configure o build command:

```txt
pnpm install --frozen-lockfile && pnpm build
```

6. Configure o publish directory:

```txt
dist
```

## 3. Variaveis de ambiente do frontend

Configure no Static Site:

```txt
VITE_API_URL=https://url-do-backend.onrender.com
VITE_IMAGES_URL=https://url-do-backend.onrender.com/images
```

Exemplo:

```txt
VITE_API_URL=https://react-gallery-plus.onrender.com
VITE_IMAGES_URL=https://react-gallery-plus.onrender.com/images
```

Depois de salvar as variaveis, faca um novo deploy do frontend.

## 4. Ajustar o backend para aceitar o frontend

Depois que o frontend for criado, copie a URL gerada pelo Render para o Static Site.

Exemplo:

```txt
https://react-gallery-plus-front.onrender.com
```

No Web Service do backend, adicione ou atualize a variavel:

```txt
FRONTEND_URL=https://url-do-frontend.onrender.com
```

Exemplo:

```txt
FRONTEND_URL=https://react-gallery-plus-front.onrender.com
```

Depois disso, faca redeploy do backend.

Essa variavel e necessaria porque o backend usa cookie de refresh token e CORS com credenciais. O backend precisa saber exatamente qual frontend pode fazer requests autenticados.

## 5. Configuracao de rotas do React

Como o app usa React Router com `BrowserRouter`, paginas como `/login` e `/fotos/:id` precisam retornar o `index.html` quando acessadas diretamente.

No Render Static Site, configure uma rewrite rule:

```txt
Source: /*
Destination: /index.html
Action: Rewrite
```

Sem isso, acessar uma rota interna diretamente pode retornar 404.

## 6. Testes apos deploy

Acesse a URL do frontend e teste:

1. Abrir a pagina inicial.
2. Ir para `/login`.
3. Fazer login com:

```txt
admin@gallery.com
123456
```

4. Fazer upload de uma foto.
5. Verificar se a imagem aparece na galeria.
6. Abrir o detalhe da foto.
7. Recarregar a pagina no detalhe da foto.
8. Fazer logout.
9. Fazer login novamente.

## 7. Checklist rapido

Backend:

```txt
FRONTEND_URL=https://url-do-frontend.onrender.com
```

Frontend:

```txt
VITE_API_URL=https://url-do-backend.onrender.com
VITE_IMAGES_URL=https://url-do-backend.onrender.com/images
```

Static Site rewrite:

```txt
/* -> /index.html
```

## 8. Problemas comuns

Se o login falhar com erro de CORS, confira se `FRONTEND_URL` no backend esta exatamente igual a URL do frontend.

Se as imagens nao carregarem, confira se `VITE_IMAGES_URL` aponta para o backend com `/images` no final.

Se uma rota interna retornar 404 ao recarregar, confira a rewrite rule do Static Site.

Se o frontend chamar `localhost`, as variaveis `VITE_API_URL` e `VITE_IMAGES_URL` nao foram configuradas ou o frontend nao foi redeployado depois da configuracao.
