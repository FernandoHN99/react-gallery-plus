import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../../../helpers/api'

interface ManagePhotoOnAlbumPayload {
   photoId: string
   albumsIds: string[]
}

export default function usePhotoAlbums() {
   const queryClient = useQueryClient()

   const managePhotoOnAlbumMutation = useMutation({
      mutationFn: async ({ photoId, albumsIds }: ManagePhotoOnAlbumPayload) => {
         await api.put(`/photos/${photoId}/albums`, {
            albumsIds,
         })
      },
      onSuccess: (_, { photoId }) => {
         queryClient.invalidateQueries({ queryKey: ['photo', photoId] })
         queryClient.invalidateQueries({ queryKey: ['photos'] })
      },
      onError: () => {
         toast.error('Erro ao gerenciar álbuns da foto')
      },
   })

   return { managePhotoOnAlbumMutation }
}
