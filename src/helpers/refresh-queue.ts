let refreshPromise: Promise<string> | null = null

export const refreshQueue = {
   async waitForRefresh(refreshAccessToken: () => Promise<string>) {
      if (refreshPromise) {
         return refreshPromise
      }

      refreshPromise = refreshAccessToken()

      try {
         return await refreshPromise
      } finally {
         refreshPromise = null
      }
   },
}
