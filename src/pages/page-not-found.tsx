import { useNavigate } from 'react-router'
import Logo from '../assets/images/galeria-plus-full-logo.svg?react'
import Button from '../components/button'
import Text from '../components/text'

export default function PageNotFound() {
   const navigate = useNavigate()

   return (
      <main className="flex min-h-screen items-center justify-center px-4">
         <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
            <Logo className="size-30" />

            <div className="flex flex-col items-center gap-3">

               <Text as="h1" variant="heading-large" className="text-label">
                  Página não encontrada
               </Text>

               <Text as="p" variant="paragraph-large" className="text-placeholder">
                  O endereço acessado não existe ou foi movido.
               </Text>
            </div>

            <Button className="w-full max-w-64" onClick={() => navigate('/')}>
               Voltar para a página principal
            </Button>
         </div>
      </main>
   )
}
