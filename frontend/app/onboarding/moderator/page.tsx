'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { ArrowLeft, ArrowRight, Upload, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { uploadToPresignedUrl } from '@/lib/upload'
import { SignedFileLink } from '@/components/signed-file'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface Compound {
  id: number
  name: string
  area?: string
}

const STEPS = [
  { id: 1, title: 'Select Compound' },
  { id: 2, title: 'Role Information' },
  { id: 3, title: 'Upload Documents' },
  { id: 4, title: 'Review & Submit' },
]

export default function ModeratorOnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(1)
  
  // Form state
  const [compoundId, setCompoundId] = useState<number | null>(null)
  const [roleTitle, setRoleTitle] = useState('')
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({})

  // Fetch compounds
  const { data: compoundsData } = useQuery<{ items: Compound[] }>({
    queryKey: ['compounds'],
    queryFn: async () => {
      const response = await api.get('/api/compounds?limit=200')
      return response.data
    },
  })

  const compounds = compoundsData?.items || []

  // Check if profile already exists
  const { data: existingProfile } = useQuery({
    queryKey: ['moderator-profile'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/moderators/me')
        return response.data
      } catch {
        return null
      }
    },
    enabled: !!user,
  })

  useEffect(() => {
    if (existingProfile) {
      // Load existing profile data
      setCompoundId(existingProfile.compound_id || null)
      setRoleTitle(existingProfile.role_title || '')
      
      // Load documents
      if (existingProfile.documents) {
        const docs: Record<string, string> = {}
        existingProfile.documents.forEach((doc: any) => {
          docs[doc.document_type] = doc.file_url
        })
        setUploadedDocs(docs)
      }

      // Redirect if already submitted
      if (existingProfile.moderator_status !== 'DRAFT') {
        router.push('/moderator/status')
      }
    }
  }, [existingProfile, router])

  const startOnboardingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/api/moderators/onboarding/start', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderator-profile'] })
      toast.success('Profile created')
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.patch('/api/moderators/me', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderator-profile'] })
      toast.success('Profile updated')
    },
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/moderators/onboarding/submit')
      return response.data
    },
    onSuccess: () => {
      toast.success('Profile submitted for review!')
      router.push('/moderator/status')
    },
  })

  const handleNext = async () => {
    // Validate current step
    if (currentStep === 1) {
      if (!compoundId) {
        toast.error('Please select a compound')
        return
      }
      // Create or update profile
      if (!existingProfile) {
        await startOnboardingMutation.mutateAsync({
          compound_id: compoundId,
          role_title: roleTitle || 'Moderator',
        })
      } else {
        await updateProfileMutation.mutateAsync({
          compound_id: compoundId,
        })
      }
    } else if (currentStep === 2) {
      if (!roleTitle.trim()) {
        toast.error('Please enter your role title')
        return
      }
      await updateProfileMutation.mutateAsync({
        role_title: roleTitle,
      })
    } else if (currentStep === 3) {
      // Validate all required documents
      const requiredDocs = ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'AUTHORIZATION_LETTER']
      const missingDocs = requiredDocs.filter((doc) => !uploadedDocs[doc])
      
      if (missingDocs.length > 0) {
        toast.error(`Please upload: ${missingDocs.join(', ')}`)
        return
      }
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFileUpload = async (documentType: string, file: File) => {
    try {
      // Get presigned URL
      const presignResponse = await api.post('/api/moderators/documents/upload-url', null, {
        params: {
          document_type: documentType,
          file_name: file.name,
          file_type: file.type,
        },
      })

      const { presigned_url, file_url } = presignResponse.data

      if (!presigned_url || !file_url) {
        throw new Error('Failed to get upload URL from server')
      }

      await uploadToPresignedUrl(presigned_url, file)

      // Save document reference
      await api.post('/api/moderators/documents', {
        document_type: documentType,
        file_url: file_url,
      })

      setUploadedDocs((prev) => ({
        ...prev,
        [documentType]: file_url,
      }))

      toast.success('Document uploaded successfully')
      queryClient.invalidateQueries({ queryKey: ['moderator-profile'] })
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || error.response?.data?.detail || 'Failed to upload document')
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label>Select Compound *</Label>
              <p className="text-sm text-gray-500 mb-4">
                Choose the compound you are authorized to moderate
              </p>
              <Combobox
                options={compounds.map((c) => ({
                  value: c.id,
                  label: c.name,
                  description: c.area || '',
                }))}
                value={compoundId || null}
                onValueChange={(value) => setCompoundId(value ? Number(value) : null)}
                placeholder="Search for a compound..."
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="roleTitle">Role Title *</Label>
              <Input
                id="roleTitle"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g., Moderator, Community Admin, HOA Manager"
              />
              <p className="text-sm text-gray-500 mt-2">
                Your official title as shown in the authorization letter
              </p>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label>National ID Front *</Label>
              <FileUpload
                documentType="NATIONAL_ID_FRONT"
                fileUrl={uploadedDocs['NATIONAL_ID_FRONT']}
                onUpload={handleFileUpload}
              />
            </div>
            <div>
              <Label>National ID Back *</Label>
              <FileUpload
                documentType="NATIONAL_ID_BACK"
                fileUrl={uploadedDocs['NATIONAL_ID_BACK']}
                onUpload={handleFileUpload}
              />
            </div>
            <div>
              <Label>Authorization Letter *</Label>
              <p className="text-sm text-gray-500 mb-2">
                Must include: compound name, your full name, role title, issue date, and signature/stamp
              </p>
              <FileUpload
                documentType="AUTHORIZATION_LETTER"
                fileUrl={uploadedDocs['AUTHORIZATION_LETTER']}
                onUpload={handleFileUpload}
              />
            </div>
          </div>
        )

      case 4:
        const selectedCompound = compounds.find((c) => c.id === compoundId)
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Your Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <strong>Compound:</strong> {selectedCompound?.name || 'Not selected'}
                </div>
                <div>
                  <strong>Role Title:</strong> {roleTitle || 'Not entered'}
                </div>
                <div>
                  <strong>Documents:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'AUTHORIZATION_LETTER'].map((docType) => (
                      <li key={docType}>
                        {docType} {uploadedDocs[docType] ? '✓' : '✗'}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Compound Moderator Onboarding</CardTitle>
            <CardDescription>
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].title}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Progress indicator */}
            <div className="flex items-center justify-between mb-8">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-1 mx-2 ${
                        currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {renderStep()}

            <div className="flex justify-between mt-8">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              {currentStep < STEPS.length ? (
                <Button
                  onClick={handleNext}
                  disabled={
                    startOnboardingMutation.isPending ||
                    updateProfileMutation.isPending
                  }
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function FileUpload({
  documentType,
  fileUrl,
  onUpload,
}: {
  documentType: string
  fileUrl?: string
  onUpload: (type: string, file: File) => void
}) {
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      await onUpload(documentType, file)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mt-2">
      {fileUrl ? (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-700">Document uploaded</span>
          </div>
          <SignedFileLink fileUrl={fileUrl} className="text-sm text-blue-600 hover:underline">
            View
          </SignedFileLink>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">
              {uploading ? 'Uploading...' : 'Click to upload or drag and drop'}
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  )
}

