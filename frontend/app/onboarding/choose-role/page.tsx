'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Wrench, Shield, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

export default function ChooseRolePage() {
  const router = useRouter()
  const { user, isLoading: userLoading } = useAuth()
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)

  // Redirect if user already has a role
  useEffect(() => {
    if (!userLoading && user && user.role) {
      // User already has a role, redirect based on role and status
      if (user.role === 'RESIDENT' || user.role === 'USER') {
        if (!user.compound_id) {
          router.push('/onboarding/compound-select')
        } else if (user.status !== 'APPROVED') {
          router.push('/verification')
        } else {
          router.push('/feed')
        }
      } else if (user.role === 'SERVICE_PROVIDER') {
        router.push('/provider/status')
      } else if (user.role === 'COMPOUND_MOD') {
        router.push('/moderator/status')
      } else {
        router.push('/feed')
      }
    }
  }, [user, userLoading, router])

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const response = await api.patch('/api/auth/me', { role })
      return response.data
    },
    onSuccess: (data, role) => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] })
      toast.success('Role selected successfully')
      
      // Redirect to appropriate onboarding flow
      if (role === 'RESIDENT') {
        router.push('/onboarding/compound-select')
      } else if (role === 'SERVICE_PROVIDER') {
        router.push('/onboarding/provider')
      } else if (role === 'COMPOUND_MOD') {
        router.push('/onboarding/moderator')
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to select role')
    },
  })

  const handleSelectRole = (role: string) => {
    setSelectedRole(role)
    updateRoleMutation.mutate(role)
  }

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Account Type
          </h1>
          <p className="text-lg text-gray-600">
            Select the type of account that best describes you
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Resident Card */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
              selectedRole === 'RESIDENT' 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-200 hover:border-blue-300'
            }`}
            onClick={() => handleSelectRole('RESIDENT')}
          >
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="p-4 bg-blue-100 rounded-full">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-center">Resident</CardTitle>
              <CardDescription className="text-center">
                I live in a compound and want to connect with my neighbors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 mb-4">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600" />
                  <span>Post and comment in community feed</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600" />
                  <span>Buy and sell items in marketplace</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-blue-600" />
                  <span>Access verified community content</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                variant={selectedRole === 'RESIDENT' ? 'default' : 'outline'}
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? 'Selecting...' : 'Select Resident'}
              </Button>
            </CardContent>
          </Card>

          {/* Service Provider Card */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
              selectedRole === 'SERVICE_PROVIDER' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 hover:border-green-300'
            }`}
            onClick={() => handleSelectRole('SERVICE_PROVIDER')}
          >
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="p-4 bg-green-100 rounded-full">
                  <Wrench className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-center">Service Provider</CardTitle>
              <CardDescription className="text-center">
                I provide services to residents and want to list my business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 mb-4">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-green-600" />
                  <span>List services in multiple compounds</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-green-600" />
                  <span>Receive service requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-green-600" />
                  <span>Build your reputation with reviews</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                variant={selectedRole === 'SERVICE_PROVIDER' ? 'default' : 'outline'}
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? 'Selecting...' : 'Select Service Provider'}
              </Button>
            </CardContent>
          </Card>

          {/* Compound Moderator Card */}
          <Card 
            className={`cursor-pointer transition-all hover:shadow-lg border-2 ${
              selectedRole === 'COMPOUND_MOD' 
                ? 'border-purple-500 bg-purple-50' 
                : 'border-gray-200 hover:border-purple-300'
            }`}
            onClick={() => handleSelectRole('COMPOUND_MOD')}
          >
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="p-4 bg-purple-100 rounded-full">
                  <Shield className="w-8 h-8 text-purple-600" />
                </div>
              </div>
              <CardTitle className="text-center">Compound Moderator</CardTitle>
              <CardDescription className="text-center">
                I'm authorized to moderate content for my compound
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600 mb-4">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-purple-600" />
                  <span>Approve and remove posts</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-purple-600" />
                  <span>Pin announcements</span>
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-purple-600" />
                  <span>Handle reports and moderation</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                variant={selectedRole === 'COMPOUND_MOD' ? 'default' : 'outline'}
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending ? 'Selecting...' : 'Select Moderator'}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>You can change your account type later in settings</p>
        </div>
      </div>
    </div>
  )
}

