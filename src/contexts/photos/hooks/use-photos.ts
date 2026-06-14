import { useQuery } from '@tanstack/react-query'
import { createSerializer, parseAsString, useQueryState } from 'nuqs'
import { fetcher } from '../../../helpers/api'
import type { Photo } from '../models/photo'

const toSearchParams = createSerializer({
   albumId: parseAsString,
   q: parseAsString,
})

const PHOTOS_STALE_TIME = 1000 * 60

export default function usePhotos() {
   const [albumId, setAlbumId] = useQueryState('albumId')
   const [q, setQ] = useQueryState('q')

   const { data, isLoading } = useQuery<Photo[]>({
      queryKey: ['photos', albumId, q],
      queryFn: () => fetcher(`/photos${toSearchParams({ albumId, q })}`),
      staleTime: PHOTOS_STALE_TIME,
   })

   return {
      photos: data || [],
      isLoadingPhotos: isLoading,
      filters: {
         albumId,
         setAlbumId,
         q,
         setQ,
      },
   }
}
