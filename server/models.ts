export interface Photo {
   id: string
   title: string
   imageId?: string
   albumsIds?: string[]
}

export interface Album {
   id: string
   title: string
}

export interface PhotoOnAlbum {
   photoId: string
   albumId: string
}

export interface User {
   id: string
   email: string
   passwordHash: string
   createdAt: string
}

export interface Database {
   photos: Photo[]
   albums: Album[]
   photosOnAlbums: PhotoOnAlbum[]
   users: User[]
}
