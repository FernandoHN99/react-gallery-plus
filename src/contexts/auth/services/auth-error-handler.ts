/**
 * Analisador de erros de autenticação
 * Classifica o tipo de erro para definir a ação apropriada
 */

export const authErrorHandler = {
   /**
    * Token de acesso expirou (mas refreshToken ainda é válido)
    * Ação: tentar refresh
    */
   isTokenExpired(error: any): boolean {
      return error?.response?.data?.code === 'TOKEN_EXPIRED'
   },

   /**
    * Refresh token expirou ou é inválido
    * Ação: logout imediato
    */
   isRefreshTokenInvalid(error: any): boolean {
      const code = error?.response?.data?.code
      return (
         code === 'REFRESH_TOKEN_EXPIRED' || code === 'INVALID_REFRESH_TOKEN'
      )
   },

   /**
    * Não há response (timeout, conexão perdida, servidor down, etc)
    * Ação: mostrar erro temporário (não logout)
    */
   isNetworkError(error: any): boolean {
      return !error?.response
   },

   /**
    * Extrai mensagem do erro para exibir ao usuário
    */
   getErrorMessage(error: any): string {
      return (
         error?.response?.data?.message || error?.message || 'Erro desconhecido'
      )
   },
}
