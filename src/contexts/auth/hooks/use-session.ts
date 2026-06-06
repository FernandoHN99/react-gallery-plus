import { useQuery } from '@tanstack/react-query'
import { authService } from '../services/auth-service'

const ONE_HOUR = 1000 * 60 * 60

export default function useSession() {
   const query = useQuery({
      queryKey: ['session'],
      queryFn: authService.getSession,
      staleTime: ONE_HOUR,
      refetchInterval: ONE_HOUR,
      retry: false,
   })

   return {
      user: query.data ?? null,
      isLoadingSession: query.isPending,
      isAuthenticated: query.isSuccess && query.data.id != null,
   }
}
