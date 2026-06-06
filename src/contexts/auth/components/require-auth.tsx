import { Navigate, Outlet, useLocation } from 'react-router'
import useSession from '../hooks/use-session'

export default function RequireAuth() {
   const { isAuthenticated, isLoadingSession } = useSession()
   const location = useLocation()

   if (isLoadingSession) {
      return (
         <div className="flex h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-primary border-t-accent-brand" />
         </div>
      )
   }

   if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />
   }

   return <Outlet />
}
