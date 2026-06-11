import { api } from './api'

let refreshPromise: Promise<string> | null = null

/**
 * Fila singleton de refresh
 * Garante que apenas 1 refresh roda por vez, mesmo com múltiplas requisições simultâneas
 */
export const refreshQueue = {
  /**
   * Aguarda a fila de refresh
   * Se já está refazendo, retorna a Promise existente
   * Se não, dispara novo refresh
   */
  async waitForRefresh(): Promise<string> {
    // Se já existe refresh em andamento, aguarda a Promise existente
    if (refreshPromise) {
      return refreshPromise
    }

    // Senão, dispara novo refresh
    refreshPromise = performRefresh()

    try {
      const token = await refreshPromise
      return token
    } finally {
      // Limpa fila após terminar (sucesso ou erro)
      refreshPromise = null
    }
  },
}

/**
 * Executa o refresh de verdade
 * Retorna novo accessToken ou lança erro
 */
async function performRefresh(): Promise<string> {
  const { data } = await api.post<{ token: string }>('/auth/refresh')
  return data.token
}
