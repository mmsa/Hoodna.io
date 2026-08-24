'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import { formatCompoundName } from '@/lib/format-compound'
import { useAuth } from '@/hooks/use-auth'
import { SignOutButton } from '@/components/sign-out-button'

interface Compound {
  id: number
  name: string
  area?: string
  city?: string
  country: string
}

export default function CompoundSelectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams?.get?.('returnTo') || '/feed'
  const { user, isLoading: userLoading, refreshUser } = useAuth()
  const [selectedCompoundId, setSelectedCompoundId] = useState<number | null>(null)
  const [error, setError] = useState('')

  // Redirect service providers and moderators away from compound selection IMMEDIATELY
  useEffect(() => {
    if (userLoading) return
    if (!user) return
    
    if (user.role === 'SERVICE_PROVIDER') {
      router.replace('/provider/status')
      return
    }
    
    if (user.role === 'COMPOUND_MOD') {
      router.replace('/moderator/status')
      return
    }
  }, [user, userLoading, router])
  
  // Early return if user is service provider or moderator (prevent rendering)
  if (!userLoading && user && (user.role === 'SERVICE_PROVIDER' || user.role === 'COMPOUND_MOD')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  const { data: compoundsData, isLoading } = useQuery<{ items: Compound[]; total: number }>({
    queryKey: ['compounds'],
    queryFn: async () => {
      // Fetch all compounds (limit=200 is max allowed)
      const response = await api.get('/api/compounds?limit=200')
      return response.data
    },
    enabled: !userLoading && !!user && user.role !== 'SERVICE_PROVIDER' && user.role !== 'COMPOUND_MOD',
  })

  // Transform compounds to combobox options
  const compoundOptions: ComboboxOption[] = useMemo(() => {
    const compounds = compoundsData?.items || []
    if (compounds.length === 0) return []
    return compounds.map((compound) => ({
      value: compound.id,
      label: formatCompoundName(compound.name),
      description: `${compound.area || compound.city || ''}, ${compound.country}`,
    }))
  }, [compoundsData])

  const updateUserMutation = useMutation({
    mutationFn: async (compoundId: number) => {
      // Update user's compound via API
      const response = await api.patch('/api/auth/me', { compound_id: compoundId })
      return { compoundId, userData: response.data }
    },
    onSuccess: async (data) => {
      await refreshUser()
      if (data.userData?.compound_id || data.compoundId) {
        if (user?.role === 'ADMIN' || user?.role === 'MODERATOR') {
          router.push(returnTo.startsWith('/') ? returnTo : '/feed')
        } else {
          router.push('/verification')
        }
      } else {
        setError('Neighbourhood selection failed. Please try again.')
      }
    },
    onError: (err: any) => {
      // Don't redirect on error - show error message instead
      const errorMessage = err.response?.data?.detail || 'Failed to update neighbourhood. Please try again.'
      setError(errorMessage)
    },
  })

  const handleSubmit = () => {
    if (!selectedCompoundId) {
      setError('Please select a neighbourhood')
      return
    }
    setError('')
    if (user?.role === 'ADMIN' || user?.role === 'MODERATOR') {
      updateUserMutation.mutate(selectedCompoundId)
      return
    }
    // Request access first, then update compound
    api.post('/api/auth/me/request-compound-access', { compound_id: selectedCompoundId })
      .then(() => {
        updateUserMutation.mutate(selectedCompoundId)
      })
      .catch((err: any) => {
        const errorMessage = err.response?.data?.detail || 'Failed to request neighbourhood access'
        setError(errorMessage)
      })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading neighbourhoods...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Select Your Neighbourhood</CardTitle>
            <CardDescription>
              {user?.role === 'ADMIN' || user?.role === 'MODERATOR'
                ? 'Pick any neighbourhood to browse as admin — no verification required.'
                : 'Search and select the compound or neighbourhood where you live'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <SignOutButton />

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="compound-select">Neighbourhood</Label>
              <Combobox
                options={compoundOptions}
                value={selectedCompoundId || null}
                onValueChange={(value) => {
                  setSelectedCompoundId(value ? Number(value) : null)
                  setError('')
                }}
                placeholder="Search for your neighbourhood..."
                searchPlaceholder="Type to search neighbourhoods..."
                emptyMessage="No neighbourhoods found. Try a different search."
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Start typing to search through {compoundsData?.total || 0} available neighbourhoods
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={!selectedCompoundId || updateUserMutation.isPending}
              size="lg"
            >
              {updateUserMutation.isPending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Setting up...
                </>
              ) : (
                <>
                  Continue
                  <span className="ml-2">→</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

