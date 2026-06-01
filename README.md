# Gallery Plus

Uma aplicação web moderna para explorar e gerenciar galerias de fotos, desenvolvida com React e Fastify.

## Descrição

Gallery Plus é uma plataforma full-stack que permite aos usuários explorar, visualizar e gerenciar coleções de fotos com uma interface intuitiva e responsiva. O projeto demonstra boas práticas de desenvolvimento web moderno, combinando um frontend robusto em React com um backend escalável em Fastify.

## Principais Tecnologias

**Frontend:**
- **Framework:** [React](https://react.dev/) 19
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Roteamento:** [React Router](https://reactrouter.com/) 7
- **Gerenciamento de Estado:** [TanStack Query](https://tanstack.com/query/latest) (React Query)
- **Formulários:** [React Hook Form](https://react-hook-form.com/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/) 4
- **UI Components:** [Radix UI](https://www.radix-ui.com/)
- **Validação:** [Zod](https://zod.dev/)
- **Notificações:** [Sonner](https://sonner.emilkowal.ski/)
- **HTTP Client:** [Axios](https://axios-http.com/)
- **Linting:** [ESLint](https://eslint.org/)

**Backend:**
- **Framework:** [Fastify](https://www.fastify.io/)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [tsup](https://tsup.egoist.dev/)
- **CORS:** [@fastify/cors](https://github.com/fastify/fastify-cors)
- **Upload de Arquivos:** [@fastify/multipart](https://github.com/fastify/fastify-multipart)
- **Arquivos Estáticos:** [@fastify/static](https://github.com/fastify/fastify-static)

## Principais Funcionalidades

- **Galeria de Fotos:** Explore uma coleção completa de fotos em uma interface visual atrativa
- **Detalhes da Foto:** Visualize informações detalhadas de cada foto
- **Showcase de Componentes:** Página dedicada para visualizar e testar componentes da aplicação
- **Upload de Imagens:** Carregue novas fotos para a galeria
- **Interface Responsiva:** Design adaptável para dispositivos móveis e desktop
- **Performance Otimizada:** Cache automático com React Query
- **Validação de Dados:** Validação robusta de formulários com Zod e React Hook Form

## Como Começar

Siga as instruções abaixo para configurar e executar o projeto em seu ambiente local.

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- [pnpm](https://pnpm.io/installation)

### Instalação

1. **Clone o repositório:**
   ```bash
   git clone <seu-repositorio>
   cd react-gallery-plus
   ```

2. **Instale as dependências:**
   ```bash
   pnpm install
   ```

3. **Configure o ambiente:**
   - Renomeie o arquivo `.env.example` para `.env`
   - Configure as variáveis de ambiente (URLs da API)

### Executando a Aplicação

A aplicação possui um servidor backend (Fastify) e um cliente frontend (React) que devem ser executados em paralelo.

#### Terminal 1: Backend (Fastify)

**Modo de desenvolvimento com watch:**
```bash
pnpm dev-server
```

**Ou, para apenas rodar o servidor compilado:**
```bash
pnpm run-server
```

O servidor estará disponível em `http://localhost:5799`

#### Terminal 2: Frontend (React + Vite)

**Modo de desenvolvimento:**
```bash
pnpm dev
```

A aplicação estará disponível em `http://localhost:5173`

### Compilação para Produção

```bash
pnpm build
```

Este comando:
- Compila o servidor Fastify com `tsup`
- Faz build do frontend React com Vite

### Linting

```bash
pnpm lint
```

Verifica a qualidade do código usando ESLint.

## Estrutura do Projeto

```
├── src/                    # Código-fonte do frontend React
│   ├── components/        # Componentes React reutilizáveis
│   ├── pages/            # Páginas da aplicação
│   ├── contexts/         # Contextos do React
│   ├── helpers/          # Funções utilitárias
│   └── assets/           # Recursos estáticos
├── server/               # Código-fonte do backend Fastify
├── public/               # Arquivos estáticos públicos
└── data/                 # Dados da aplicação
```

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
VITE_API_URL=http://localhost:5799
VITE_IMAGES_URL=http://localhost:5799/images
```