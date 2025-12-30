'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { Checkbox } from '@/components/ui/checkbox'
import { ArrowLeft, ArrowRight, Upload, CheckCircle, X, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Compound {
  id: number
  name: string
  area?: string
}

interface ServiceCategory {
  id: number
  name: string
  description?: string
  icon?: string
  display_order: number
}

const STEPS = [
  { id: 1, title: 'Basic Information' },
  { id: 2, title: 'Service Areas' },
  { id: 3, title: 'Verification Method' },
  { id: 4, title: 'Upload Documents' },
  { id: 5, title: 'Review & Submit' },
]

export default function ProviderOnboardingPage() {
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(1)
  
  // Form state
  const [providerType, setProviderType] = useState<'INDIVIDUAL' | 'REGISTERED_BUSINESS' | ''>('')
  const [verificationMethod, setVerificationMethod] = useState<'COMMERCIAL_REGISTER' | 'NATIONAL_ID_OCCUPATION' | ''>('')
  const [businessName, setBusinessName] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [phone, setPhone] = useState('')
  const [selectedCompounds, setSelectedCompounds] = useState<number[]>([])
  const [occupationText, setOccupationText] = useState('')
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({})
  
  // Change request state
  const [showChangeRequestModal, setShowChangeRequestModal] = useState(false)
  const [changeRequestCategoryId, setChangeRequestCategoryId] = useState<number | null>(null)
  const [changeRequestCompounds, setChangeRequestCompounds] = useState<number[]>([])
  const [changeRequestReason, setChangeRequestReason] = useState('')

  // Fetch compounds
  const { data: compoundsData } = useQuery<{ items: Compound[] }>({
    queryKey: ['compounds'],
    queryFn: async () => {
      const response = await api.get('/api/compounds?limit=200')
      return response.data
    },
  })

  const compounds = compoundsData?.items || []

  // Fetch service categories
  const { data: categories } = useQuery<ServiceCategory[]>({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const response = await api.get('/api/service-categories')
      return response.data
    },
  })

  // Transform categories to combobox options
  const categoryOptions: ComboboxOption[] = (categories || []).map((cat) => ({
    value: cat.id,
    label: cat.icon ? `${cat.icon} ${cat.name}` : cat.name,
    description: cat.description,
  }))

  // Check if profile already exists
  const { data: existingProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ['provider-profile'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/providers/me')
        return response.data
      } catch {
        return null
      }
    },
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data when navigating to this page
  })

  useEffect(() => {
    if (existingProfile) {
      // Load existing profile data
      setProviderType(existingProfile.provider_type || '')
      setVerificationMethod(existingProfile.verification_method || '')
      setBusinessName(existingProfile.business_name || '')
      setCategoryId(existingProfile.category_id || null)
      setPhone(existingProfile.phone || '')
      setSelectedCompounds(existingProfile.service_area_compound_ids || [])
      setOccupationText(existingProfile.occupation_text || '')
      
      // Load documents
      if (existingProfile.documents) {
        const docs: Record<string, string> = {}
        existingProfile.documents.forEach((doc: any) => {
          docs[doc.document_type] = doc.file_url
        })
        setUploadedDocs(docs)
      }

      // Redirect if status is SUBMITTED, IN_REVIEW, or SUSPENDED (but allow editing if APPROVED or REJECTED)
      if (existingProfile.provider_status && 
          !['DRAFT', 'APPROVED', 'REJECTED'].includes(existingProfile.provider_status)) {
        router.push('/provider/status')
        return
      }
    }
  }, [existingProfile, router])

  const startOnboardingMutation = useMutation({
    mutationFn: async (data: any) => {
      // Validate data before sending
      if (!data.provider_type || !data.verification_method || !data.business_name || !data.category_id || !data.phone || !data.service_area_compound_ids || data.service_area_compound_ids.length === 0) {
        throw new Error('Missing required fields')
      }
      const response = await api.post('/api/providers/onboarding/start', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-profile'] })
      toast.success('Profile created')
    },
    onError: (error: any) => {
      // Don't show error here - let handleNext handle it
      throw error
    },
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.patch('/api/providers/me', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-profile'] })
      toast.success('Profile updated')
    },
  })

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/api/providers/onboarding/submit')
      return response.data
    },
    onSuccess: () => {
      toast.success('Profile submitted for review!')
      router.push('/provider/status')
    },
  })

  const changeRequestMutation = useMutation({
    mutationFn: async (data: { category_id?: number | null; service_area_compound_ids?: number[] | null; reason: string }) => {
      const response = await api.post('/api/providers/me/request-change', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-profile'] })
      toast.success('Change request submitted! An admin will review it.')
      setShowChangeRequestModal(false)
      setChangeRequestCategoryId(null)
      setChangeRequestCompounds([])
      setChangeRequestReason('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.detail || 'Failed to submit change request')
    },
  })

  const saveChangesMutation = useMutation({
    mutationFn: async () => {
      // Save all current form data (excluding category_id and service_area_compound_ids for approved providers)
      const updateData: any = {}
      if (businessName) updateData.business_name = businessName
      if (phone) updateData.phone = phone
      // Only include category_id and service_area_compound_ids if profile is not approved
      if (existingProfile?.provider_status !== 'APPROVED') {
        if (categoryId) updateData.category_id = categoryId
        if (selectedCompounds.length > 0) updateData.service_area_compound_ids = selectedCompounds
      }
      if (occupationText) updateData.occupation_text = occupationText
      if (providerType) updateData.provider_type = providerType
      if (verificationMethod) updateData.verification_method = verificationMethod
      
      const response = await api.patch('/api/providers/me', updateData)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-profile'] })
      toast.success('Profile updated successfully!')
      router.push('/provider/status')
    },
  })

  const handleNext = async () => {
    // Validate current step
    if (currentStep === 1) {
      if (!businessName || !phone || !categoryId) {
        toast.error('Please fill in all required fields')
        return
      }
      // Only update if profile exists, don't create yet (need provider_type and verification_method)
      if (existingProfile) {
        await updateProfileMutation.mutateAsync({
          business_name: businessName,
          category_id: categoryId ? Number(categoryId) : null,
          phone,
        })
      }
      // If no profile exists, just move to next step (will create in step 3)
    } else if (currentStep === 2) {
      if (selectedCompounds.length === 0) {
        toast.error('Please select at least one service area')
        return
      }
      // Only update if profile exists, otherwise just move to next step
      if (existingProfile) {
        await updateProfileMutation.mutateAsync({
          service_area_compound_ids: selectedCompounds,
        })
      }
      // If no profile exists, just move to next step (will create in step 3)
    } else if (currentStep === 3) {
      if (!providerType || !verificationMethod) {
        toast.error('Please select provider type and verification method')
        return
      }
      if (verificationMethod === 'NATIONAL_ID_OCCUPATION' && !occupationText) {
        toast.error('Please enter your occupation')
        return
      }
      // Create profile if it doesn't exist, otherwise update
      if (!existingProfile) {
        // Validate that we have all required fields for creation
        if (!businessName || !phone || !categoryId || selectedCompounds.length === 0) {
          toast.error('Please complete all previous steps')
          return
        }
        // Ensure provider_type and verification_method are valid enum values, not empty strings
        if (!providerType || providerType === '' || !verificationMethod || verificationMethod === '') {
          toast.error('Please select provider type and verification method')
          return
        }
        try {
          await startOnboardingMutation.mutateAsync({
            provider_type: providerType as 'INDIVIDUAL' | 'REGISTERED_BUSINESS',
            verification_method: verificationMethod as 'COMMERCIAL_REGISTER' | 'NATIONAL_ID_OCCUPATION',
            business_name: businessName,
            category_id: Number(categoryId),
            phone,
            service_area_compound_ids: selectedCompounds,
            occupation_text: occupationText || null,
          })
          // If creation succeeded, invalidate and refetch profile
          await queryClient.invalidateQueries({ queryKey: ['provider-profile'] })
        } catch (error: any) {
          // If error is "already exists", fetch existing profile and update instead
          if (error?.response?.data?.detail?.includes('already exists')) {
            // Refetch profile and update
            const profileResponse = await api.get('/api/providers/me')
            queryClient.setQueryData(['provider-profile'], profileResponse.data)
            // Now update with the new data
            await updateProfileMutation.mutateAsync({
              provider_type: providerType as 'INDIVIDUAL' | 'REGISTERED_BUSINESS',
              verification_method: verificationMethod as 'COMMERCIAL_REGISTER' | 'NATIONAL_ID_OCCUPATION',
              occupation_text: occupationText || null,
            })
          } else {
            throw error // Re-throw if it's a different error
          }
        }
      } else {
        await updateProfileMutation.mutateAsync({
          provider_type: providerType as 'INDIVIDUAL' | 'REGISTERED_BUSINESS',
          verification_method: verificationMethod as 'COMMERCIAL_REGISTER' | 'NATIONAL_ID_OCCUPATION',
          occupation_text: occupationText || null,
        })
      }
    } else if (currentStep === 4) {
      // Validate documents based on verification method
      if (verificationMethod === 'COMMERCIAL_REGISTER') {
        if (!uploadedDocs['COMMERCIAL_REGISTER']) {
          toast.error('Please upload Commercial Register document')
          return
        }
      } else if (verificationMethod === 'NATIONAL_ID_OCCUPATION') {
        if (!uploadedDocs['NATIONAL_ID_FRONT'] || !uploadedDocs['NATIONAL_ID_BACK']) {
          toast.error('Please upload both National ID front and back')
          return
        }
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
      const presignResponse = await api.post('/api/providers/documents/upload-url', null, {
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

      // Check if this is a local storage upload (presigned_url contains /api/uploads/upload)
      const isLocalStorage = presigned_url.includes('/api/uploads/upload')
      
      let uploadResponse: Response
      try {
        if (isLocalStorage) {
          // Local storage: use FormData and POST
          // file_path is already in the URL as a query parameter, so we don't need to add it again
          const formData = new FormData()
          formData.append('file', file)
          
          uploadResponse = await fetch(presigned_url, {
            method: 'POST',
            body: formData,
          })
        } else {
          // S3: use PUT with file as body
          uploadResponse = await fetch(presigned_url, {
            method: 'PUT',
            body: file,
            headers: {
              'Content-Type': file.type,
            },
          })
        }
      } catch (fetchError: any) {
        throw new Error(`Failed to upload file: ${fetchError?.message || 'Network error'}`)
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => 'Unknown error')
        throw new Error(`Upload failed: ${errorText}`)
      }

      // Save document reference
      await api.post('/api/providers/documents', {
        document_type: documentType,
        file_url: file_url,
      })

      setUploadedDocs((prev) => ({
        ...prev,
        [documentType]: file_url,
      }))

      toast.success('Document uploaded successfully')
      queryClient.invalidateQueries({ queryKey: ['provider-profile'] })
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
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter your business name"
              />
            </div>
            <div>
              <Label htmlFor="category">Service Category *</Label>
              {existingProfile?.provider_status === 'APPROVED' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="px-3 py-2 border rounded-md bg-gray-50">
                        {categories?.find(c => c.id === categoryId)?.name || 'Not set'}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Category changes require admin approval
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setChangeRequestCategoryId(categoryId) // Start with current value
                        setChangeRequestCompounds([...selectedCompounds]) // Start with current values
                        setChangeRequestReason('')
                        setShowChangeRequestModal(true)
                      }}
                      className="ml-2"
                    >
                      Request Change
                    </Button>
                  </div>
                  {existingProfile?.change_request_status === 'PENDING' && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                      <AlertCircle className="h-4 w-4" />
                      <span>Change request pending admin review</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Combobox
                    options={categoryOptions}
                    value={categoryId}
                    onValueChange={(value) => {
                      // Ensure value is converted to number
                      setCategoryId(value ? Number(value) : null)
                    }}
                    placeholder="Select a service category..."
                    searchPlaceholder="Search categories..."
                    emptyMessage="No categories found"
                    className="w-full"
                  />
                  {categories && categoryId && (
                    <p className="text-sm text-gray-500 mt-2">
                      {categories.find(c => c.id === categoryId)?.description}
                    </p>
                  )}
                </>
              )}
            </div>
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+20 123 456 7890"
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label>Select Service Areas *</Label>
              {existingProfile?.provider_status === 'APPROVED' ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-4">
                    Current service areas: {selectedCompounds.length} compound(s)
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                    {compounds
                      .filter(c => selectedCompounds.includes(c.id))
                      .map((compound) => (
                        <div key={compound.id} className="flex items-center space-x-2">
                          <Checkbox checked={true} disabled />
                          <Label className="cursor-not-allowed opacity-60">
                            {compound.name} {compound.area && `(${compound.area})`}
                          </Label>
                        </div>
                      ))}
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-gray-500">
                      Service area changes require admin approval
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setChangeRequestCategoryId(categoryId) // Start with current value
                        setChangeRequestCompounds([...selectedCompounds]) // Start with current values
                        setChangeRequestReason('')
                        setShowChangeRequestModal(true)
                      }}
                    >
                      Request Change
                    </Button>
                  </div>
                  {existingProfile?.change_request_status === 'PENDING' && (
                    <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>Change request pending admin review</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Select all compounds where you provide services
                  </p>
                  <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-4">
                    {compounds.map((compound) => (
                      <div key={compound.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`compound-${compound.id}`}
                          checked={selectedCompounds.includes(compound.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCompounds([...selectedCompounds, compound.id])
                            } else {
                              setSelectedCompounds(selectedCompounds.filter((id) => id !== compound.id))
                            }
                          }}
                        />
                        <Label htmlFor={`compound-${compound.id}`} className="cursor-pointer">
                          {compound.name} {compound.area && `(${compound.area})`}
                        </Label>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label>Provider Type *</Label>
              <RadioGroup value={providerType} onValueChange={(v) => setProviderType(v as any)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="INDIVIDUAL" id="individual" />
                  <Label htmlFor="individual" className="cursor-pointer">Individual</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="REGISTERED_BUSINESS" id="business" />
                  <Label htmlFor="business" className="cursor-pointer">Registered Business</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>Verification Method *</Label>
              <RadioGroup value={verificationMethod} onValueChange={(v) => setVerificationMethod(v as any)}>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="COMMERCIAL_REGISTER" id="commercial" />
                    <Label htmlFor="commercial" className="cursor-pointer">
                      Commercial Register (سجل تجاري)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="NATIONAL_ID_OCCUPATION" id="national-id" />
                    <Label htmlFor="national-id" className="cursor-pointer">
                      National ID with Occupation
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            {verificationMethod === 'NATIONAL_ID_OCCUPATION' && (
              <div>
                <Label htmlFor="occupation">Occupation *</Label>
                <Input
                  id="occupation"
                  value={occupationText}
                  onChange={(e) => setOccupationText(e.target.value)}
                  placeholder="e.g., Plumber, Electrician, etc."
                />
              </div>
            )}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            {verificationMethod === 'COMMERCIAL_REGISTER' ? (
              <>
                <div>
                  <Label>Commercial Register (سجل تجاري) *</Label>
                  <FileUpload
                    documentType="COMMERCIAL_REGISTER"
                    fileUrl={uploadedDocs['COMMERCIAL_REGISTER']}
                    onUpload={handleFileUpload}
                  />
                </div>
                <div>
                  <Label>Tax Card (optional)</Label>
                  <FileUpload
                    documentType="TAX_CARD"
                    fileUrl={uploadedDocs['TAX_CARD']}
                    onUpload={handleFileUpload}
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Review Your Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <strong>Business Name:</strong> {businessName}
                </div>
                <div>
                  <strong>Phone:</strong> {phone}
                </div>
                <div>
                  <strong>Service Areas:</strong> {selectedCompounds.length} compound(s)
                </div>
                <div>
                  <strong>Provider Type:</strong> {providerType}
                </div>
                <div>
                  <strong>Verification Method:</strong> {verificationMethod}
                </div>
                {verificationMethod === 'NATIONAL_ID_OCCUPATION' && (
                  <div>
                    <strong>Occupation:</strong> {occupationText}
                  </div>
                )}
                <div>
                  <strong>Documents:</strong>
                  <ul className="list-disc list-inside mt-2">
                    {Object.keys(uploadedDocs).map((docType) => (
                      <li key={docType}>{docType}</li>
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
        {/* Show loading state while checking for existing profile */}
        {isLoadingProfile && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading profile...</p>
            </div>
          </div>
        )}
        
        {!isLoadingProfile && (
          <>
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
            <CardTitle>Service Provider Onboarding</CardTitle>
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
                <>
                  {existingProfile?.provider_status === 'APPROVED' ? (
                    <Button
                      onClick={() => saveChangesMutation.mutate()}
                      disabled={saveChangesMutation.isPending}
                    >
                      {saveChangesMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => submitMutation.mutate()}
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending ? 'Submitting...' : 'Submit for Review'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>
      
      {/* Change Request Modal */}
      <Dialog open={showChangeRequestModal} onOpenChange={setShowChangeRequestModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Category or Service Areas Change</DialogTitle>
            <DialogDescription>
              Changes to your category or service areas require admin approval. Please provide a reason for your request.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="change-category">New Service Category (optional)</Label>
              <Combobox
                options={categoryOptions}
                value={changeRequestCategoryId}
                onValueChange={(value) => {
                  setChangeRequestCategoryId(value ? Number(value) : null)
                }}
                placeholder="Select a new category (leave unchanged if not changing)..."
                searchPlaceholder="Search categories..."
                emptyMessage="No categories found"
                className="w-full"
              />
              {changeRequestCategoryId && categories && (
                <p className="text-sm text-gray-500 mt-2">
                  Current: {categories.find(c => c.id === categoryId)?.name} → 
                  New: {categories.find(c => c.id === changeRequestCategoryId)?.name}
                </p>
              )}
            </div>
            
            <div>
              <Label>New Service Areas (optional)</Label>
              <p className="text-sm text-gray-500 mb-2">
                Select new compounds (leave unchanged if not changing)
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-4">
                {compounds.map((compound) => (
                  <div key={compound.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`change-compound-${compound.id}`}
                      checked={changeRequestCompounds.includes(compound.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setChangeRequestCompounds([...changeRequestCompounds, compound.id])
                        } else {
                          setChangeRequestCompounds(changeRequestCompounds.filter((id) => id !== compound.id))
                        }
                      }}
                    />
                    <Label htmlFor={`change-compound-${compound.id}`} className="cursor-pointer">
                      {compound.name} {compound.area && `(${compound.area})`}
                    </Label>
                  </div>
                ))}
              </div>
              {changeRequestCompounds.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  Current: {selectedCompounds.length} compound(s) → 
                  New: {changeRequestCompounds.length} compound(s)
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="change-reason">Reason for Change *</Label>
              <Textarea
                id="change-reason"
                value={changeRequestReason}
                onChange={(e) => setChangeRequestReason(e.target.value)}
                placeholder="Please explain why you need to change your category or service areas..."
                rows={4}
                minLength={10}
              />
              <p className="text-xs text-gray-500 mt-1">
                Minimum 10 characters required
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowChangeRequestModal(false)
                setChangeRequestCategoryId(null)
                setChangeRequestCompounds([])
                setChangeRequestReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (changeRequestReason.length < 10) {
                  toast.error('Please provide a reason (minimum 10 characters)')
                  return
                }
                
                const hasChanges = 
                  (changeRequestCategoryId !== null && changeRequestCategoryId !== categoryId) ||
                  (changeRequestCompounds.length > 0 && 
                   JSON.stringify([...changeRequestCompounds].sort()) !== JSON.stringify([...selectedCompounds].sort()))
                
                if (!hasChanges) {
                  toast.error('Please select at least one change')
                  return
                }
                
                const requestData: any = {
                  reason: changeRequestReason,
                }
                
                // Only include fields that are actually changing
                if (changeRequestCategoryId !== null && changeRequestCategoryId !== categoryId) {
                  requestData.category_id = changeRequestCategoryId
                }
                
                const currentCompoundsSorted = [...(selectedCompounds || [])].sort()
                const newCompoundsSorted = [...changeRequestCompounds].sort()
                if (JSON.stringify(newCompoundsSorted) !== JSON.stringify(currentCompoundsSorted)) {
                  requestData.service_area_compound_ids = changeRequestCompounds
                }
                
                changeRequestMutation.mutate(requestData)
              }}
              disabled={changeRequestMutation.isPending}
            >
              {changeRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View
          </a>
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

