import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import Logo from '../assets/images/galeria-plus-full-logo.svg?react'
import Button from '../components/button'
import InputText from '../components/input-text'
import Text from '../components/text'
import useLogin from '../contexts/auth/hooks/use-login'
import { type LoginFormSchema, loginFormSchema } from '../contexts/auth/schemas'
import { authErrorHandler } from '../contexts/auth/services/auth-error-handler'
import { MOCK_CREDENTIALS } from '../contexts/auth/services/auth-service'
import { clearAuthSessionExpired } from '../helpers/auth-events'

type LoginLocationState = {
   from?: {
      pathname?: string
   }
   sessionExpired?: boolean
}

export default function PageLogin() {
   const navigate = useNavigate()
   const location = useLocation()
   const { login, isLoggingIn } = useLogin()

   const locationState = location.state as LoginLocationState | null
   const fromLocation = locationState?.from
   const from = fromLocation?.pathname ?? '/'
   const sessionExpired = Boolean(locationState?.sessionExpired)

   useEffect(() => {
      if (!sessionExpired) return

      toast.error('Sessão expirada. Por favor, faça login novamente.', {
         id: 'session-expired',
      })
      clearAuthSessionExpired()
      navigate(location.pathname, {
         replace: true,
         state: fromLocation ? { from: fromLocation } : null,
      })
   }, [fromLocation, location.pathname, navigate, sessionExpired])

   const {
      register,
      handleSubmit,
      formState: { errors },
   } = useForm<LoginFormSchema>({
      resolver: zodResolver(loginFormSchema),
   })

   async function onSubmit(data: LoginFormSchema) {
      try {
         await login(data)
         navigate(from, { replace: true })
      } catch (error) {
         if (authErrorHandler.getReason(error) === 'NETWORK') return

         toast.error('E-mail ou senha inválidos')
      }
   }

   return (
      <div className="flex min-h-screen items-center justify-center">
         <div className="flex w-full max-w-sm flex-col items-center gap-8 px-4">
            <Logo className="h-6" />

            <form
               onSubmit={handleSubmit(onSubmit)}
               className="flex w-full flex-col gap-4"
            >
               <div className="flex flex-col gap-1">
                  <Text variant="label-small" className="text-accent-paragraph">
                     E-mail
                  </Text>
                  <InputText
                     type="email"
                     placeholder="admin@gallery.com"
                     error={errors.email?.message}
                     {...register('email')}
                     value="admin@gallery.com"
                  />
               </div>

               <div className="flex flex-col gap-1">
                  <Text variant="label-small" className="text-accent-paragraph">
                     Senha
                  </Text>
                  <InputText
                     type="password"
                     placeholder="••••••"
                     error={errors.password?.message}
                     {...register('password')}
                     value="123456"
                  />
               </div>

               <Button
                  type="submit"
                  className="mt-2 w-full"
                  handling={isLoggingIn}
                  disabled={isLoggingIn}
               >
                  Entrar
               </Button>
            </form>

            <Text
               variant="paragraph-small"
               className="text-center text-placeholder"
            >
               Use <strong>{MOCK_CREDENTIALS.email}</strong> /{' '}
               <strong>{MOCK_CREDENTIALS.password}</strong>
            </Text>
         </div>
      </div>
   )
}
