import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../../helpers/api'
import usePhotoAlbums from '../../photos/hooks/use-photo-albums'
import usePhotos from '../../photos/hooks/use-photos'
import type { Album } from '../models/album'
import type { AlbumNewFormSchema } from '../schemas'

export default function useAlbum() {
   const queryClient = useQueryClient()
   const { photos } = usePhotos()
   const { managePhotoOnAlbumMutation } = usePhotoAlbums()

   const createAlbumMutation = useMutation({
      mutationFn: async (payload: AlbumNewFormSchema) => {
         const { data: album } = await api.post<Album>('/albums', {
            title: payload.title,
         })

          if (payload.photosIds && payload.photosIds.length > 0) {
             await Promise.all(
                payload.photosIds.map((photoId) => {
                   const photoAlbumsIds =
                      photos
                         .find((photo) => photo.id === photoId)
                         ?.albums.map((album) => album.id) || []
                   return managePhotoOnAlbumMutation.mutateAsync({
                      photoId,
                      albumsIds: [...photoAlbumsIds, album.id],
                   })
                }),
             )
          }
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['albums'] })
         queryClient.invalidateQueries({ queryKey: ['photos'] })
         toast.success('Álbum criado com sucesso')
      },
      onError: () => {
         toast.error('Erro ao criar álbum')
      },
   })

   return {
      createAlbumMutation,
   }
}
