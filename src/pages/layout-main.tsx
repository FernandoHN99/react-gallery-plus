import { Outlet } from 'react-router'
import MainContent from '../components/main-content'
import MainHeader from '../components/main-header'

export default function LayoutMain() {
   return (
      <>
         <MainHeader className="mt-9" />
         <MainContent>
            <Outlet />
         </MainContent>
      </>
   )
}
