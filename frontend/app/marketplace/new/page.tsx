'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'

const listingSchema = z.object({
  category: z.enum(['PROPERTY', 'CAR', 'ITEM', 'SERVICE']),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  price: z.string().optional(),
  intent: z.enum(['SELL', 'RENT']),
})

type ListingForm = z.infer<typeof listingSchema>

export default function NewListingPage() {
  const router = useRouter()
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
  })

  const createListingMutation = useMutation({
    mutationFn: async (data: ListingForm & { image_urls: string[] }) => {
      const response = await api.post('/api/listings', {
        ...data,
        price: data.price ? parseFloat(data.price) : null,
      })
      return response.data
    },
    onSuccess: () => {
      router.push('/marketplace')
    },
  })

  const uploadImage = async (file: File) => {
    setUploading(true)
    try {
      // Get presigned URL from backend
      const presignResponse = await api.post('/api/listings/images/presign', {
        file_name: file.name,
        file_type: file.type,
      })

      const { presigned_url, file_url } = presignResponse.data

      // Check if this is a local storage upload
      const isLocalStorage = presigned_url.includes('/api/uploads/upload')
      
      if (isLocalStorage) {
        // Local storage: use FormData and POST
        const formData = new FormData()
        formData.append('file', file)
        const urlParams = new URL(presigned_url).searchParams
        const filePath = urlParams.get('file_path')
        if (filePath) {
          formData.append('file_path', filePath)
        }
        
        await fetch(presigned_url, {
          method: 'POST',
          body: formData,
        })
      } else {
        // S3: use PUT with file as body
        await fetch(presigned_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })
      }

      // Add file_url to images array
      setImages([...images, file_url])
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Image upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = (data: ListingForm) => {
    createListingMutation.mutate({ ...data, image_urls: images })
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create New Listing</CardTitle>
            <CardDescription>List an item, property, car, or service</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  {...register('category')}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="PROPERTY">Property</option>
                  <option value="CAR">Car</option>
                  <option value="ITEM">Item</option>
                  <option value="SERVICE">Service</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" {...register('title')} />
                {errors.title && (
                  <p className="text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  {...register('description')}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price (Optional)</Label>
                  <Input id="price" type="number" {...register('price')} />
                </div>
                <div className="space-y-2">
                  <Label>Intent</Label>
                  <select
                    {...register('intent')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="SELL">Sell</option>
                    <option value="RENT">Rent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Images</Label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    files.forEach((file) => uploadImage(file))
                  }}
                  disabled={uploading}
                />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {images.map((url, idx) => (
                    <img key={idx} src={url} alt={`Upload ${idx}`} className="rounded" />
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createListingMutation.isPending}>
                {createListingMutation.isPending ? 'Creating...' : 'Create Listing'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

