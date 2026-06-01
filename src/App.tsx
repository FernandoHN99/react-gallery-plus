import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import LayoutMain from './pages/layout-main'
import PageComponents from './pages/page-components'
import PageHome from './pages/page-home'
import PagePhotoDetails from './pages/page-photo-details'

const queryClient = new QueryClient()

export default function App() {
   return (
      <QueryClientProvider client={queryClient}>
         <NuqsAdapter>
            <Toaster position="bottom-center" />
            <BrowserRouter>
               <Routes>
                  <Route element={<LayoutMain />}>
                     <Route index element={<PageHome />} />
                     <Route path="/fotos/:id" element={<PagePhotoDetails />} />
                     <Route path="/componentes" element={<PageComponents />} />
                  </Route>
               </Routes>
            </BrowserRouter>
         </NuqsAdapter>
      </QueryClientProvider>
   )
}
