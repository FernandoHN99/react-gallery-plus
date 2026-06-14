import { useMutation, useQueryClient } from '@tanstack/react-query'
import { clearAuthSessionExpired } from '../../../helpers/auth-events'
import { authService } from '../services/auth-service'

export default function useLogin() {
   const queryClient = useQueryClient()

   const { mutateAsync, isPending } = useMutation({
      mutationFn: ({ email, password }: { email: string; password: string }) =>
         authService.login(email, password),
      onSuccess: (user) => {
         clearAuthSessionExpired()
         queryClient.setQueryData(['session'], user)
      },
   })

   return {
      login: mutateAsync,
      isLoggingIn: isPending,
   }
}
