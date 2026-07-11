'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import api from '@/lib/api'
import { uploadToPresignedUrl } from '@/lib/upload'
import { SignedFileImage } from '@/components/signed-file'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import {
  ArrowLeft,
  Upload,
  X,
  Image as ImageIcon,
  Wrench,
  Coins,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import Link from 'next/link'

const listingSchema = z.object({
  category: z.enum(['PROPERTY', 'CAR', 'ITEM', 'SERVICE']),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  price: z.string().optional(),
  intent: z.enum(['SELL', 'RENT']),
})

type ListingForm = z.infer<typeof listingSchema>

export default function EditListingPage() {
  const router = useRouter()
  const params = useParams()
  const listingId = params?.id ? parseInt(params.id as string) : NaN
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if user is a service provider
  const isServiceProvider = user?.role === 'SERVICE_PROVIDER'

  // Fetch existing listing
  const { data: listing, isLoading: isLoadingListing } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: async () => {
      const response = await api.get(`/api/listings/${listingId}`)
      return response.data
    },
    enabled: !Number.isNaN(listingId),
  })

  // Redirect if not owner
  useEffect(() => {
    if (listing && user && listing.owner_id !== user.id) {
      toast({
        title: "Access Denied",
        description: "You can only edit your own listings",
        variant: "destructive",
      })
      router.push(`/listing/${listingId}`)
    }
  }, [listing, user, listingId, router, toast])

  // Initialize form with listing data
  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      category: listing?.category || 'SERVICE',
      title: listing?.title || '',
      description: listing?.description || '',
      price: listing?.price?.toString() || '',
      intent: listing?.intent || 'SELL',
    },
  })

  // Update form when listing loads
  useEffect(() => {
    if (listing) {
      form.reset({
        category: listing.category,
        title: listing.title,
        description: listing.description || '',
        price: listing.price?.toString() || '',
        intent: listing.intent || 'SELL',
      })
      setImages(listing.image_urls || [])
    }
  }, [listing, form])

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file.',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    try {
      const response = await api.post('/api/listings/images/presign', {
        file_name: file.name,
        file_type: file.type,
      })
      const { presigned_url, file_url } = response.data

      await uploadToPresignedUrl(presigned_url, file)

      return file_url
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error?.response?.data?.detail || 'Failed to upload image',
        variant: 'destructive',
      })
      throw error
    } finally {
      setUploading(false)
    }
  }

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newImages: string[] = []
    for (let i = 0; i < files.length; i++) {
      try {
        const url = await uploadImage(files[i])
        newImages.push(url)
      } catch (error) {
        // Error already handled in uploadImage
      }
    }
    setImages([...images, ...newImages])
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const updateListingMutation = useMutation({
    mutationFn: async (data: ListingForm & { image_urls: string[] }) => {
      const response = await api.patch(`/api/listings/${listingId}`, {
        ...data,
        price: data.price ? parseFloat(data.price) : null,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] })
      queryClient.invalidateQueries({ queryKey: ['services'] })
      queryClient.invalidateQueries({ queryKey: ['my-services'] })
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      
      toast({
        title: 'Listing updated! 🎉',
        description: 'Your listing has been updated successfully.',
        variant: 'success',
      })
      // Redirect based on user role
      if (isServiceProvider) {
        router.push('/services')
      } else {
        router.push('/marketplace')
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update listing',
        description: error?.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: ListingForm) => {
    updateListingMutation.mutate({
      ...data,
      image_urls: images,
    })
  }

  if (isLoadingListing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading listing...</p>
        </div>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="shadow-xl">
          <CardContent className="p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Listing Not Found</h2>
            <p className="text-gray-600 mb-6">The listing you're trying to edit doesn't exist.</p>
            <Link href="/services">
              <Button>Back to Services</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const backUrl = (isServiceProvider && listing.category === 'SERVICE') ? '/services' : '/marketplace'
  const backText = (isServiceProvider && listing.category === 'SERVICE') ? 'Back to My Services' : 'Back to Marketplace'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href={backUrl}>
          <Button variant="ghost" className="mb-6 hover:bg-blue-50">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backText}
          </Button>
        </Link>

        <Card className="shadow-xl border-2 border-gray-200">
          <CardHeader>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Edit Listing
            </CardTitle>
            <CardDescription>
              Update your listing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Title */}
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...form.register('title')}
                  placeholder={listing.category === 'SERVICE' ? "e.g., Professional Plumbing Service" : "Enter listing title"}
                  className="mt-2"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-red-600 mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  placeholder={listing.category === 'SERVICE' ? "Describe your service, experience, and availability." : "Enter listing description"}
                  className="mt-2 min-h-32"
                />
              </div>

              {/* Price */}
              <div>
                <Label htmlFor="price">Price (EGP)</Label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">EGP</span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    {...form.register('price')}
                    placeholder="0.00 EGP"
                    className="pl-16"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {listing.category === 'SERVICE' 
                    ? "Enter your service rate (per hour, per session, or one-time fee)"
                    : "Enter the price for your listing"}
                </p>
              </div>

              {/* Intent */}
              <div>
                <Label htmlFor="intent">{listing.category === 'SERVICE' ? 'Service Type' : 'Listing Type'} *</Label>
                <Select
                  value={form.watch('intent')}
                  onValueChange={(value) => form.setValue('intent', value as 'SELL' | 'RENT')}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELL">
                      {listing.category === 'SERVICE' ? 'One-Time Service' : 'For Sale'}
                    </SelectItem>
                    <SelectItem value="RENT">
                      {listing.category === 'SERVICE' ? 'Per Hour / Session' : 'For Rent'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Images */}
              <div>
                <Label>Images</Label>
                <div className="mt-2 space-y-4">
                  {/* Existing Images */}
                  {images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {images.map((url, index) => (
                        <div key={index} className="relative group">
                          <SignedFileImage
                            fileUrl={url}
                            alt={`Image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      setDragActive(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setDragActive(false)
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragActive(false)
                      handleImageUpload(e.dataTransfer.files)
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageUpload(e.target.files)}
                      className="hidden"
                    />
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">
                      Drag and drop images here, or{' '}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-blue-600 hover:underline"
                      >
                        browse
                      </button>
                    </p>
                    <p className="text-sm text-gray-500">PNG, JPG, WEBP up to 5MB</p>
                    {uploading && (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">Uploading...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateListingMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {updateListingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Coins className="w-4 h-4 mr-2" />
                      Update Listing
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
