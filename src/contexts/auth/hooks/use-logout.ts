import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearAuthSessionExpired } from '../../../helpers/auth-events'
import { authService } from '../services/auth-service'

export default function useLogout() {
   const queryClient = useQueryClient()

   const { mutateAsync, isPending } = useMutation({
      mutationFn: authService.logout,
      onSuccess: () => {
         clearAuthSessionExpired()
         queryClient.setQueryData(['session'], null)
      },
   })

   return {
      logout: mutateAsync,
      isLoggingOut: isPending,
   }
}
