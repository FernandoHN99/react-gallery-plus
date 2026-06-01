import React from 'react'
import { photoEditSchema } from '../../schemas'
import type { Photo } from '../models/photo'

export default function usePhotoEdit(photo?: Photo) {
   const [editedTitle, setEditedTitle] = React.useState(photo?.title ?? '')
   const [selectedAlbumsIds, setSelectedAlbumsIds] = React.useState<string[]>(
      photo?.albums?.map((a) => a.id) ?? [],
   )

   React.useEffect(() => {
      setEditedTitle(photo?.title ?? '')
      setSelectedAlbumsIds(photo?.albums?.map((a) => a.id) ?? [])
   }, [photo])

   function handleTitleChange(value: string) {
      setEditedTitle(value)
   }

   function handleAlbumToggle(albumId: string) {
      setSelectedAlbumsIds((prev) =>
         prev.includes(albumId)
            ? prev.filter((id) => id !== albumId)
            : [...prev, albumId],
      )
   }

   function resetToOriginal() {
      setEditedTitle(photo?.title ?? '')
      setSelectedAlbumsIds(photo?.albums?.map((a) => a.id) ?? [])
   }

   const titleValidation = photoEditSchema.shape.title.safeParse(editedTitle)
   const isTitleValid = titleValidation.success
   const titleError = isTitleValid
      ? ''
      : (titleValidation.error.errors[0]?.message ?? '')

   const originalAlbumsIds = photo?.albums?.map((a) => a.id) ?? []
   const hasChanges =
      editedTitle !== photo?.title ||
      selectedAlbumsIds.length !== originalAlbumsIds.length ||
      selectedAlbumsIds.some((id) => !originalAlbumsIds.includes(id)) ||
      originalAlbumsIds.some((id) => !selectedAlbumsIds.includes(id))

   return {
      editedTitle,
      selectedAlbumsIds,
      titleError,
      isTitleValid,
      hasChanges,
      handleTitleChange,
      handleAlbumToggle,
      resetToOriginal,
   }
}
