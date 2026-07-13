'use client'

import { useAuth } from '@/hooks/use-auth'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AccountShell } from '@/components/account-shell'
import { Mail, Phone, MapPin, Shield, Loader2, Home, Building2, Briefcase, CheckCircle, User, Camera } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { AppShell, PageLayout } from '@/components/ui/page-layout'
import { resolveUploadContentType, uploadToPresignedUrl } from '@/lib/upload'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth()
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  async function uploadAvatar(file: File) {
    const mimeType = resolveUploadContentType(file)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      toast.error('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Profile pictures must be 5 MB or smaller.')
      return
    }

    setUploadingAvatar(true)
    try {
      const presign = await api.post('/api/auth/me/avatar/presign', {
        file_name: file.name,
        file_type: mimeType,
      })
      await uploadToPresignedUrl(presign.data.presigned_url, file, mimeType)
      await api.put('/api/auth/me/avatar', {
        avatar_url: presign.data.file_url,
      })
      await refreshUser()
      toast.success('Profile picture updated.')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || error?.message || 'Could not update profile picture.')
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // Fetch provider profile if user is a service provider
  const { data: providerProfile } = useQuery({
    queryKey: ['provider-profile'],
    queryFn: async () => {
      const response = await api.get('/api/providers/me')
      return response.data
    },
    enabled: !!user && user.role === 'SERVICE_PROVIDER',
    retry: false,
  })

  // Fetch compound details if user has compound_id
  const { data: compound } = useQuery<{ id: number; name: string; area?: string }>({
    queryKey: ['compound', user?.compound_id],
    queryFn: async () => {
      if (!user?.compound_id) return null
      const response = await api.get(`/api/compounds?limit=200`)
      const compounds = response.data.items || []
      const foundCompound = compounds.find((c: any) => c.id === user.compound_id)
      return foundCompound || null
    },
    enabled: !!user?.compound_id && user?.role !== 'SERVICE_PROVIDER',
  })

  // Fetch service area compounds for service providers
  const { data: serviceAreaCompounds } = useQuery<Array<{ id: number; name: string; area?: string }>>({
    queryKey: ['service-area-compounds', providerProfile?.service_area_compound_ids],
    queryFn: async () => {
      if (!providerProfile?.service_area_compound_ids?.length) return []
      const response = await api.get(`/api/compounds?limit=200`)
      const compounds = response.data.items || []
      return providerProfile.service_area_compound_ids
        .map((id: number) => compounds.find((c: any) => c.id === id))
        .filter(Boolean)
    },
    enabled: !!providerProfile?.service_area_compound_ids?.length,
  })

  if (isLoading) {
    return (
      <AppShell>
        <PageLayout width="md" className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </PageLayout>
      </AppShell>
    )
  }

  if (!user) {
    return (
      <AppShell>
        <PageLayout width="md" className="flex min-h-[50vh] items-center justify-center">
          <Card className="eljiran-card w-full max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="mb-4 text-muted-foreground">Please sign in to view your profile.</p>
              <Link href="/auth/login">
                <Button>Sign in</Button>
              </Link>
            </CardContent>
          </Card>
        </PageLayout>
      </AppShell>
    )
  }

  return (
    <AccountShell title="Profile" description="Your account details and neighbourhood info.">
      <Card className="eljiran-card">
        <CardHeader>
          <CardTitle>Account information</CardTitle>
          <CardDescription>Your profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar name={user.name} src={user.avatar_url} className="h-20 w-20 text-2xl" />
              <button
                type="button"
                aria-label="Change profile picture"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm disabled:opacity-60"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void uploadAvatar(file)
                }}
              />
            </div>
              <div>
                <h2 className="text-2xl font-bold">{user.name}</h2>
                {user.role === 'ADMIN' || user.role === 'MODERATOR' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-sm text-primary font-medium">{user.role}</span>
                  </div>
                ) : user.role === 'SERVICE_PROVIDER' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Briefcase className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Service Provider</span>
                    {providerProfile?.provider_status === 'APPROVED' && (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>

              {user.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium">{user.phone}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Account Type</p>
                  <p className="font-medium capitalize">
                    {user.role === 'SERVICE_PROVIDER' ? 'Service Provider' :
                     user.role === 'COMPOUND_MOD' ? 'Compound Moderator' :
                     user.role === 'ADMIN' ? 'Administrator' :
                     user.role === 'MODERATOR' ? 'Moderator' :
                     'Resident'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className="font-medium capitalize">{user.status.toLowerCase().replace('_', ' ')}</p>
                </div>
              </div>

              {/* Show compound for residents */}
              {compound && user.role !== 'SERVICE_PROVIDER' && (
                <div className="flex items-center gap-3">
                  <Home className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Compound</p>
                    <p className="font-medium">{compound.name}</p>
                    {compound.area && (
                      <p className="text-sm text-gray-500 mt-1">{compound.area}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Show provider-specific information */}
              {user.role === 'SERVICE_PROVIDER' && providerProfile && (
                <>
                  {providerProfile.provider_type && (
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Profile Type</p>
                        <p className="font-medium capitalize">
                          {providerProfile.provider_type.toLowerCase().replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {providerProfile.business_name && (
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Business Name</p>
                        <p className="font-medium">{providerProfile.business_name}</p>
                      </div>
                    </div>
                  )}
                  {providerProfile.category && (
                    <div className="flex items-center gap-3">
                      <Briefcase className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Service Category</p>
                        <p className="font-medium">{providerProfile.category.name}</p>
                      </div>
                    </div>
                  )}
                  {serviceAreaCompounds && serviceAreaCompounds.length > 0 && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Service Areas</p>
                        <p className="font-medium">
                          {serviceAreaCompounds.map(c => c.name).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Provider Status</p>
                      <p className="font-medium capitalize">
                        {providerProfile.provider_status?.toLowerCase().replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t flex gap-2 flex-wrap">
              {/* Show provider-specific buttons for service providers */}
              {user.role === 'SERVICE_PROVIDER' ? (
                <>
                  <Link href="/provider/status">
                    <Button variant="outline" className="flex-1 min-w-[140px]">
                      Verification Status
                    </Button>
                  </Link>
                  {(providerProfile?.provider_status === 'DRAFT' || 
                    providerProfile?.provider_status === 'APPROVED' ||
                    providerProfile?.provider_status === 'REJECTED') && (
                    <Link href="/onboarding/provider">
                      <Button className="flex-1 min-w-[140px]">
                        {providerProfile?.provider_status === 'APPROVED' ? 'Edit Profile' : 'Update Profile'}
                      </Button>
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link href="/verification">
                    <Button variant="outline">Verification Status</Button>
                  </Link>
                  <Link href="/settings">
                    <Button>Edit Profile</Button>
                  </Link>
                </>
              )}
            </div>
          </CardContent>
      </Card>
    </AccountShell>
  )
}

