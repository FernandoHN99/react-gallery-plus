import { useQuery } from '@tanstack/react-query'
import type { User } from '../models/user'
import { authService } from '../services/auth-service'

const ONE_HOUR = 1000 * 60 * 60

export default function useSession() {
   const query = useQuery<User | null>({
      queryKey: ['session'],
      queryFn: authService.getSession,
      staleTime: ONE_HOUR,
      refetchInterval: ONE_HOUR,
      retry: false,
   })

   const isAuthenticated = query.isSuccess && !!query.data?.id

   return {
      user: query.data ?? null,
      isLoadingSession: query.isPending,
      isAuthenticated,
   }
}
