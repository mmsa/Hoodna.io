'use client'

import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Mail, Phone, MapPin, Shield, Loader2, Home } from 'lucide-react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export default function ProfilePage() {
  const { user, isLoading } = useAuth()

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
    enabled: !!user?.compound_id,
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

              {compound && (
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
            </div>

            <div className="pt-4 border-t flex gap-2">
              <Link href="/verification">
                <Button variant="outline">Verification Status</Button>
              </Link>
              <Link href="/settings">
                <Button>Edit Profile</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

