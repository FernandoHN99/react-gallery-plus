# Plano de implantacao no Render

## 1. Repositorio

Use a branch de producao:

```txt
main
```

Ela ja esta com os ajustes necessarios para deploy no Render.

## 2. Criar o backend

No Render:

1. Clique em **New**.
2. Selecione **Web Service**.
3. Conecte o repositorio `react-gallery-plus`.
4. Selecione a branch `main`.
5. Runtime: **Node**.
6. Configure o build command:

```txt
pnpm install --frozen-lockfile && pnpm build-server
```

7. Configure o start command:

```txt
pnpm run-server
```

8. Configure as variaveis de ambiente:

```txt
NODE_ENV=production
JWT_ACCESS_SECRET=coloque_um_valor_grande_e_secreto
JWT_REFRESH_SECRET=coloque_outro_valor_grande_e_secreto
```

## 3. Configurar Persistent Disk

Para que o `db.json` e as imagens enviadas nao sumam em restart ou redeploy, configure um Persistent Disk no backend.

Mount path:

```txt
/opt/render/project/src/data
```

Sugestao para aprendizado:

```txt
1 GB
```

Sem Persistent Disk, o app pode funcionar, mas os dados podem ser perdidos quando o servico reiniciar ou fizer novo deploy.

## 4. Testar o backend

Depois do deploy, abra a rota de health check:

```txt
https://sua-api.onrender.com/health
```

Ela deve retornar algo parecido com:

```json
{
   "status": "ok"
}
```

Guarde a URL do backend para configurar o frontend.

## 5. Criar o frontend

No Render:

1. Clique em **New**.
2. Selecione **Static Site**.
3. Conecte o mesmo repositorio.
4. Selecione a branch `main`.
5. Configure o build command:

```txt
pnpm install --frozen-lockfile && pnpm build
```

6. Configure o publish directory:

```txt
dist
```

7. Configure as variaveis de ambiente:

```txt
VITE_API_URL=https://sua-api.onrender.com
VITE_IMAGES_URL=https://sua-api.onrender.com/images
```

Troque `https://sua-api.onrender.com` pela URL real do backend criado no passo anterior.

## 6. Testar o app

Acesse a URL do frontend e faca login com:

```txt
admin@gallery.com
123456
```

Teste os principais fluxos:

1. Login.
2. Upload de foto.
3. Abrir detalhe da foto.
4. Recarregar a pagina.
5. Logout.
6. Novo login.

## 7. Ordem recomendada

1. Criar o backend.
2. Configurar as variaveis de ambiente do backend.
3. Configurar o Persistent Disk no backend.
4. Fazer deploy do backend.
5. Testar `/health`.
6. Criar o frontend.
7. Configurar `VITE_API_URL` e `VITE_IMAGES_URL`.
8. Fazer deploy do frontend.
9. Testar login, upload e visualizacao de imagens.

## Observacao

Esse deploy e adequado para aprendizado. Para uma producao real, considere trocar depois:

1. `db.json` por Postgres, SQLite persistente ou outro banco adequado.
2. `data/images` por Cloudinary, S3 ou outro storage de arquivos.
3. URLs `onrender.com` por dominio proprio.
4. Secrets temporarios por secrets fortes e rotacionaveis.
