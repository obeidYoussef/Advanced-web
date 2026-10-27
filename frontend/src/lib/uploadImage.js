import { supabase } from './supabase.js'

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumSize = 5 * 1024 * 1024

export async function uploadHotelImage(file, userId) {
  if (!allowedTypes.has(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.')
  }

  if (file.size > maximumSize) {
    throw new Error('The image must be 5 MB or smaller.')
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage
    .from('hotel-images')
    .upload(path, file, { contentType: file.type })

  if (error) throw error

  return supabase.storage.from('hotel-images').getPublicUrl(path).data.publicUrl
}
