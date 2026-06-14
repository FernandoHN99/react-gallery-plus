import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

const PHOTO_DETAIL_STALE_TIME = 1000 * 60

export default function usePhoto(id?: string) {
   const navigate = useNavigate()
   const { data, isLoading } = useQuery<PhotoDetailResponse>({
      queryKey: ['photo', id],
      queryFn: () => fetcher(`/photos/${id}`),
      enabled: !!id,
      staleTime: PHOTO_DETAIL_STALE_TIME,
   })
   const queryClient = useQueryClient()
   const { managePhotoOnAlbumMutation } = usePhotoAlbums()

   const createPhotoMutation = useMutation({
      mutationFn: async (payload: PhotoNewFormSchema) => {
         const { data: photo } = await api.post<Photo>('/photos', {
            title: payload.title,
         })

         await api.post(
            `/photos/${photo.id}/image`,
            { file: payload.file[0] },
            { headers: { 'Content-Type': 'multipart/form-data' } },
         )

         if (payload.albumsIds && payload.albumsIds.length > 0) {
            await managePhotoOnAlbumMutation.mutateAsync({ photoId: photo.id, albumsIds: payload.albumsIds })
         }
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['photos'] })
         toast.success('Foto criada com sucesso')
      },
      onError: () => {
         toast.error('Erro ao criar foto')
      },
   })

   const updatePhotoMutation = useMutation({
      mutationFn: async ({ photoId, title, albumsIds }: photoEditSchema) => {
         const originalAlbumsIds = data?.albums?.map((a) => a.id) ?? []
         const titleChanged = title !== data?.title
         const albumsChanged =
            albumsIds.length !== originalAlbumsIds.length ||
            albumsIds.some((id) => !originalAlbumsIds.includes(id))

         if (titleChanged) await api.patch(`/photos/${photoId}`, { title })
         if (albumsChanged) await managePhotoOnAlbumMutation.mutateAsync({ photoId, albumsIds })
      },
      onSuccess: (_, { photoId }) => {
         queryClient.invalidateQueries({ queryKey: ['photo', photoId] })
         queryClient.invalidateQueries({ queryKey: ['photos'] })
         toast.success('Foto atualizada com sucesso')
      },
      onError: () => {
         toast.error('Erro ao atualizar foto')
      },
   })

   const deletePhotoMutation = useMutation({
      mutationFn: async (photoId: string) => {
         await api.delete(`/photos/${photoId}`)
      },
      onSuccess: () => {
         toast.success('Foto excluída com sucesso')
         navigate('/')
      },
      onError: () => {
         toast.error('Erro ao excluir foto')
      },
   })

   return {
      photo: data,
      nextPhotoId: data?.nextPhotoId,
      previousPhotoId: data?.previousPhotoId,
      isLoadingPhoto: isLoading,
      createPhotoMutation,
      updatePhotoMutation,
      deletePhotoMutation,
   }
}
