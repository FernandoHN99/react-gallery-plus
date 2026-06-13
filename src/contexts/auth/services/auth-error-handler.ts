export type AuthFailure =
   | 'TOKEN_EXPIRED'
   | 'MISSING_ACCESS_TOKEN'
   | 'INVALID_ACCESS_TOKEN'
   | 'REFRESH_TOKEN_EXPIRED'
   | 'INVALID_REFRESH_TOKEN'
   | 'NETWORK'
   | null

const authFailureCodes = [
   'TOKEN_EXPIRED',
   'MISSING_ACCESS_TOKEN',
   'INVALID_ACCESS_TOKEN',
   'REFRESH_TOKEN_EXPIRED',
   'INVALID_REFRESH_TOKEN',
] as const

type AuthFailureCode = (typeof authFailureCodes)[number]

function isObject(value: unknown): value is Record<string, unknown> {
   return typeof value === 'object' && value !== null
}

function getResponseData(error: unknown): Record<string, unknown> | null {
   if (!isObject(error)) return null

   const { response } = error

   if (!isObject(response)) return null

   const { data } = response

   return isObject(data) ? data : null
}

function isAuthFailureCode(code: unknown): code is AuthFailureCode {
   return authFailureCodes.includes(code as AuthFailureCode)
}

function hasResponse(error: unknown): boolean {
   return isObject(error) && Boolean(error.response)
}

export const authErrorHandler = {
   getAuthFailure(error: unknown): AuthFailure {
      if (!hasResponse(error)) return 'NETWORK'

      const code = getResponseData(error)?.code

      return isAuthFailureCode(code) ? code : null
   },

   getErrorMessage(error: unknown): string {
      const responseMessage = getResponseData(error)?.message

      if (typeof responseMessage === 'string') return responseMessage

      if (isObject(error) && typeof error.message === 'string') {
         return error.message
      }

      return 'Erro desconhecido'
   },
}
