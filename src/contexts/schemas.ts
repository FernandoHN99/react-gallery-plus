import { z } from 'zod'

export const photoNewFormSchema = z.object({
   title: z.string().min(1, { message: 'Campo obrigatório' }).max(255),
   file: z
      .instanceof(FileList)
      .refine((file) => file.length > 0, { message: 'Campo obrigatório' }),
   albumsIds: z.array(z.string().uuid()).optional(),
})

export type PhotoNewFormSchema = z.infer<typeof photoNewFormSchema>

export const photoEditSchema = z.object({
   photoId: z.string().uuid().min(1, { message: 'Campo Obrigatório' }),
   title: z.string().min(1, { message: 'Campo obrigatório' }).max(255),
   albumsIds: z.array(z.string().uuid()),
})

export type photoEditSchema = z.infer<typeof photoEditSchema>
