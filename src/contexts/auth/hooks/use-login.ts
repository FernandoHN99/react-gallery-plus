import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '../services/auth-service'

export default function useLogin() {
   const queryClient = useQueryClient()

   const { mutateAsync, isPending } = useMutation({
      mutationFn: ({ email, password }: { email: string; password: string }) =>
         authService.login(email, password),
      onSuccess: (user) => {
         queryClient.setQueryData(['session'], user)
      },
   })

   return {
      login: mutateAsync,
      isLoggingIn: isPending,
   }
}
