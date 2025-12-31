'use client'

import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Mail, Phone, MapPin, Shield, Loader2, Home, Building2, Briefcase, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export default function ProfilePage() {
  const { user, isLoading } = useAuth()

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-4">Please sign in to view your profile.</p>
            <Link href="/auth/login">
              <Button>Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Profile
          </h1>
        </div>

        {/* Profile Card */}
        <Card className="shadow-xl border-2 border-gray-200">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{user.name}</h2>
                {user.role === 'ADMIN' || user.role === 'MODERATOR' ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-600 font-medium">{user.role}</span>
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
      </div>
    </div>
  )
}

