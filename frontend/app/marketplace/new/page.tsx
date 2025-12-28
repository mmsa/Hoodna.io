'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useMutation } from '@tanstack/react-query'
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
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Upload,
  X,
  Image as ImageIcon,
  Home as HomeIcon,
  Car,
  Package,
  Wrench,
  DollarSign,
  FileText,
  Sparkles,
  Loader2,
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

const CATEGORIES = [
  { value: 'PROPERTY', label: 'Property', icon: HomeIcon, color: 'blue', gradient: 'from-blue-400 to-blue-600' },
  { value: 'CAR', label: 'Car', icon: Car, color: 'red', gradient: 'from-red-400 to-red-600' },
  { value: 'ITEM', label: 'Item', icon: Package, color: 'green', gradient: 'from-green-400 to-green-600' },
  { value: 'SERVICE', label: 'Service', icon: Wrench, color: 'purple', gradient: 'from-purple-400 to-purple-600' },
]

export default function NewListingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      category: 'ITEM',
      intent: 'SELL',
    },
  })

  const selectedCategory = watch('category')
  const selectedIntent = watch('intent')

  const createListingMutation = useMutation({
    mutationFn: async (data: ListingForm & { image_urls: string[] }) => {
      const response = await api.post('/api/listings', {
        ...data,
        price: data.price ? parseFloat(data.price) : null,
      })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: 'Listing created! 🎉',
        description: 'Your listing has been posted successfully.',
        variant: 'success',
      })
      router.push('/marketplace')
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create listing',
        description: error?.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      })
    },
  })

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
      const presignResponse = await api.post('/api/listings/images/presign', {
        file_name: file.name,
        file_type: file.type,
      })

      const { presigned_url, file_url } = presignResponse.data

      const isLocalStorage = presigned_url.includes('/api/uploads/upload')
      
      if (isLocalStorage) {
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
        await fetch(presigned_url, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })
      }

      setImages([...images, file_url])
      toast({
        title: 'Image uploaded',
        description: 'Your image has been uploaded successfully.',
      })
    } catch (error) {
      console.error('Upload failed:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files)
      files.forEach((file) => uploadImage(file))
    }
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const onSubmit = (data: ListingForm) => {
    createListingMutation.mutate({ ...data, image_urls: images })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/marketplace">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Create New Listing
              </h1>
              <p className="text-gray-600 mt-1">
                Share your item, property, car, or service with your community
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Category Selection */}
          <Card className="border-2 border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                Category
              </CardTitle>
              <CardDescription>What are you listing?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {CATEGORIES.map((category) => {
                  const Icon = category.icon
                  const isSelected = selectedCategory === category.value
                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => setValue('category', category.value as any)}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? category.value === 'PROPERTY'
                            ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                            : category.value === 'CAR'
                            ? 'border-red-500 bg-red-50 shadow-lg scale-105'
                            : category.value === 'ITEM'
                            ? 'border-green-500 bg-green-50 shadow-lg scale-105'
                            : 'border-purple-500 bg-purple-50 shadow-lg scale-105'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${category.gradient} flex items-center justify-center mx-auto mb-2`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <p className={`font-semibold text-sm ${
                        isSelected
                          ? category.value === 'PROPERTY'
                            ? 'text-blue-700'
                            : category.value === 'CAR'
                            ? 'text-red-700'
                            : category.value === 'ITEM'
                            ? 'text-green-700'
                            : 'text-purple-700'
                          : 'text-gray-700'
                      }`}>
                        {category.label}
                      </p>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <div className={`w-5 h-5 rounded-full ${
                            category.value === 'PROPERTY'
                              ? 'bg-blue-500'
                              : category.value === 'CAR'
                              ? 'bg-red-500'
                              : category.value === 'ITEM'
                              ? 'bg-green-500'
                              : 'bg-purple-500'
                          } flex items-center justify-center`}>
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              {errors.category && (
                <p className="text-sm text-red-600 mt-2">{errors.category.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card className="border-2 border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Basic Information
              </CardTitle>
              <CardDescription>Tell us about your listing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base font-semibold">
                  Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder="e.g., Samsung 55 inch Smart TV - Like New"
                  className="h-12 text-base"
                />
                {errors.title && (
                  <p className="text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-base font-semibold">
                  Description
                </Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Describe your item in detail. Include condition, features, and any relevant information..."
                  className="min-h-[120px] text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Intent */}
          <Card className="border-2 border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Pricing & Type
              </CardTitle>
              <CardDescription>Set your price and listing type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-base font-semibold">
                    Price (EGP)
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      id="price"
                      type="number"
                      {...register('price')}
                      placeholder="0.00"
                      className="h-12 pl-10 text-base"
                    />
                  </div>
                  <p className="text-xs text-gray-500">Leave empty if price is negotiable</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Listing Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setValue('intent', 'SELL')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedIntent === 'SELL'
                          ? 'border-red-500 bg-red-50 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${
                        selectedIntent === 'SELL' ? 'bg-red-500' : 'bg-gray-200'
                      } flex items-center justify-center mx-auto mb-2`}>
                        <span className="text-white font-bold">$</span>
                      </div>
                      <p className={`font-semibold text-sm ${
                        selectedIntent === 'SELL' ? 'text-red-700' : 'text-gray-700'
                      }`}>
                        For Sale
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setValue('intent', 'RENT')}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        selectedIntent === 'RENT'
                          ? 'border-blue-500 bg-blue-50 shadow-lg'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${
                        selectedIntent === 'RENT' ? 'bg-blue-500' : 'bg-gray-200'
                      } flex items-center justify-center mx-auto mb-2`}>
                        <span className="text-white font-bold">R</span>
                      </div>
                      <p className={`font-semibold text-sm ${
                        selectedIntent === 'RENT' ? 'text-blue-700' : 'text-gray-700'
                      }`}>
                        For Rent
                      </p>
                    </button>
                  </div>
                  {errors.intent && (
                    <p className="text-sm text-red-600 mt-2">{errors.intent.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card className="border-2 border-gray-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-purple-600" />
                Photos
              </CardTitle>
              <CardDescription>Add photos to make your listing stand out</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    files.forEach((file) => uploadImage(file))
                  }}
                  disabled={uploading}
                  className="hidden"
                />
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center mb-4">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    {uploading ? 'Uploading...' : 'Drag & drop images here'}
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    or click to browse
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="border-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose Files
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Image Preview Grid */}
              {images.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    Uploaded Images ({images.length})
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((url, idx) => (
                      <div key={idx} className="relative group">
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                          <img
                            src={url}
                            alt={`Upload ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        {idx === 0 && (
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-green-500 text-white text-xs font-semibold rounded">
                            Main
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Link href="/marketplace" className="flex-1">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base border-2"
              >
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={createListingMutation.isPending}
              className="flex-1 h-12 text-base bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all"
            >
              {createListingMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Listing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create Listing
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
