import { useQuery } from '@tanstack/react-query'
import { fetcher } from '../../../helpers/api'
import type { Album } from '../models/album'

const ALBUMS_STALE_TIME = 1000 * 60 * 5

export default function useAlbums() {
   const { data, isLoading } = useQuery<Album[]>({
      queryKey: ['albums'],
      queryFn: () => fetcher('/albums'),
      staleTime: ALBUMS_STALE_TIME,
   })

   return {
      albums: data || [],
      isLoadingAlbums: isLoading,
   }
}
