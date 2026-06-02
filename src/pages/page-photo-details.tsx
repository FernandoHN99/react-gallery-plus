import React from 'react'
import { useParams } from 'react-router'
import Button from '../components/button'
import Container from '../components/container'
import ImagePreview from '../components/image-preview'
import InputText from '../components/input-text'
import Skeleton from '../components/skeleton'
import Text from '../components/text'
import AlbumsListSelectable from '../contexts/albums/components/albums-list-selectable'
import useAlbums from '../contexts/albums/hooks/use-albums'
import PhotosNavigator from '../contexts/photos/components/photos-navigator'
import usePhoto from '../contexts/photos/hooks/use-photo'
import usePhotoEdit from '../contexts/photos/hooks/use-photo-edit'
import type { Photo } from '../contexts/photos/models/photo'

export default function PagePhotoDetails() {
   const { id } = useParams()
   const {
      photo,
      isLoadingPhoto,
      previousPhotoId,
      nextPhotoId,
      deletePhotoMutation,
      updatePhotoMutation,
   } = usePhoto(id)
   const { albums, isLoadingAlbums } = useAlbums()
   const [editPhotoMode, setEditPhotoMode] = React.useState(false)

   const {
      editedTitle,
      selectedAlbumsIds,
      titleError,
      isTitleValid,
      hasChanges,
      handleTitleChange,
      handleAlbumToggle,
      resetToOriginal,
   } = usePhotoEdit(photo)

   function handleCancelEdit() {
      resetToOriginal()
      setEditPhotoMode(false)
   }

   async function handleSavePhoto() {
      if (!isTitleValid) return

      await updatePhotoMutation.mutateAsync({
         photoId: photo!.id,
         title: editedTitle,
         albumsIds: selectedAlbumsIds,
      })
      setEditPhotoMode(false)
   }

   if (!isLoadingPhoto && !photo) {
      return <div>Foto não encontrada</div>
   }

   return (
      <Container>
         <header className="flex items-center justify-between gap-8 mb-8">
            {!isLoadingPhoto ? (
               <div className="flex-1 min-w-0">
                  {!editPhotoMode ? (
                     <Text as="div" variant="heading-large">
                        {photo?.title}
                     </Text>
                  ) : (
                     <div className="space-y-1">
                        <InputText
                           value={editedTitle}
                           onChange={(e) => handleTitleChange(e.target.value)}
                        />
                        {titleError && (
                           <Text
                              variant="paragraph-small"
                              className="text-accent-red"
                           >
                              {titleError}
                           </Text>
                        )}
                     </div>
                  )}
               </div>
            ) : (
               <Skeleton className="w-48 h-8" />
            )}

            <PhotosNavigator
               loading={isLoadingPhoto}
               previousPhotoId={previousPhotoId}
               nextPhotoId={nextPhotoId}
            />
         </header>

         <div className="grid grid-cols-[21rem_1fr] gap-24">
            <div className="space-y-3">
               {!isLoadingPhoto ? (
                  <ImagePreview
                     src={`${import.meta.env.VITE_IMAGES_URL}/${photo?.imageId}`}
                     title={photo?.title}
                     imageClassName="h-[21rem]"
                  />
               ) : (
                  <Skeleton className="h-[21rem]" />
               )}

               {!isLoadingPhoto ? (
                  <div className="flex items-center justify-start gap-3">
                     <Button
                        variant={!editPhotoMode ? 'primary' : 'ghost'}
                        onClick={
                           !editPhotoMode
                              ? () => setEditPhotoMode(true)
                              : handleCancelEdit
                        }
                        disabled={
                           deletePhotoMutation.isPending ||
                           updatePhotoMutation.isPending
                        }
                     >
                        {!editPhotoMode ? 'Editar' : 'Cancelar'}
                     </Button>
                     {editPhotoMode ? (
                        <Button
                           variant="primary"
                           onClick={handleSavePhoto}
                           disabled={
                              !isTitleValid ||
                              !hasChanges ||
                              updatePhotoMutation.isPending
                           }
                        >
                           {updatePhotoMutation.isPending
                              ? 'Salvando...'
                              : 'Salvar'}
                        </Button>
                     ) : (
                        <Button
                           variant="destructive"
                           onClick={() => deletePhotoMutation.mutate(photo!.id)}
                           disabled={deletePhotoMutation.isPending}
                        >
                           {deletePhotoMutation.isPending
                              ? 'Excluindo...'
                              : 'Excluir'}
                        </Button>
                     )}
                  </div>
               ) : (
                  <Skeleton className="w-20 h-10" />
               )}
            </div>

            <div className="py-3">
               <Text as="h3" variant="heading-medium" className="mb-6">
                  Álbuns
               </Text>
               <AlbumsListSelectable
                  photo={photo as Photo}
                  albums={albums}
                  loading={isLoadingAlbums}
                  disable={!editPhotoMode || updatePhotoMutation.isPending}
                  editMode={editPhotoMode}
                  selectedAlbumsIds={selectedAlbumsIds}
                  onAlbumToggle={handleAlbumToggle}
               />
            </div>
         </div>
      </Container>
   )
}
