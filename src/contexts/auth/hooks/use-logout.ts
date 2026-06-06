import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '../services/auth-service'

export default function useLogout() {
   const queryClient = useQueryClient()

   const { mutateAsync, isPending } = useMutation({
      mutationFn: authService.logout,
      onSuccess: () => {
         queryClient.setQueryData(['session'], null)
      },
   })

   return {
      logout: mutateAsync,
      isLoggingOut: isPending,
   }
}
