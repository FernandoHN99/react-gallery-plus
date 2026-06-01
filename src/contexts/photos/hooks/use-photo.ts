import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { api, fetcher } from '../../../helpers/api'
import type { PhotoNewFormSchema, photoEditSchema } from '../../schemas'
import type { Photo } from '../models/photo'
import usePhotoAlbums from './use-photo-albums'

interface PhotoDetailResponse extends Photo {
   nextPhotoId?: string
   previousPhotoId?: string
}

export default function usePhoto(id?: string) {
   const navigate = useNavigate()
   const { data, isLoading } = useQuery<PhotoDetailResponse>({
      queryKey: ['photo', id],
      queryFn: () => fetcher(`/photos/${id}`),
      enabled: !!id,
   })
   const queryClient = useQueryClient()
   const { managePhotoOnAlbum } = usePhotoAlbums()

   async function createPhoto(payload: PhotoNewFormSchema) {
      try {
         const { data: photo } = await api.post<Photo>('/photos', {
            title: payload.title,
         })

         await api.post(
            `/photos/${photo.id}/image`,
            {
               file: payload.file[0],
            },
            {
               headers: {
                  'Content-Type': 'multipart/form-data',
               },
            },
         )

         if (payload.albumsIds && payload.albumsIds.length > 0) {
            await managePhotoOnAlbum(photo.id, payload.albumsIds)
         }

         queryClient.invalidateQueries({ queryKey: ['photos'] })

         toast.success('Foto crida com sucesso')
      } catch (error) {
         toast.success('Erro ao criar foto')
         throw error
      }
   }

   async function updatePhoto({ photoId, title, albumsIds }: photoEditSchema) {
      try {
         const originalAlbumsIds = data?.albums?.map((a) => a.id) ?? []
         const titleChanged = title !== data?.title
         const albumsChanged =
            albumsIds.length !== originalAlbumsIds.length ||
            albumsIds.some((id) => !originalAlbumsIds.includes(id))

         if (titleChanged) await api.patch(`/photos/${photoId}`, { title })
         if (albumsChanged) await managePhotoOnAlbum(photoId, albumsIds)

         queryClient.invalidateQueries({ queryKey: ['photo', photoId] })
         queryClient.invalidateQueries({ queryKey: ['photos'] })

         toast.success('Foto atualizada com sucesso')
      } catch (error) {
         toast.error('Erro ao atualizar foto')
         throw error
      }
   }

   async function deletePhoto(photoId: string) {
      try {
         await api.delete(`/photos/${photoId}`)

         toast.success('Foto excluída com sucesso')

         navigate('/')
      } catch (error) {
         toast.error('Erro ao excluir foto')
         throw error
      }
   }

   return {
      photo: data,
      nextPhotoId: data?.nextPhotoId,
      previousPhotoId: data?.previousPhotoId,
      isLoadingPhoto: isLoading,
      createPhoto,
      updatePhoto,
      deletePhoto,
   }
}
