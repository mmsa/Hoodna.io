'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'

interface Compound {
  id: number
  name: string
  area?: string
  city?: string
  country: string
}

export default function CompoundSelectPage() {
  const router = useRouter()
  const [selectedCompoundId, setSelectedCompoundId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const { data: compoundsData, isLoading } = useQuery<{ items: Compound[]; total: number }>({
    queryKey: ['compounds'],
    queryFn: async () => {
      // Fetch all compounds (limit=200 is max allowed)
      const response = await api.get('/api/compounds?limit=200')
      return response.data
    },
  })

  const compounds = compoundsData?.items || []

  // Transform compounds to combobox options
  const compoundOptions: ComboboxOption[] = useMemo(() => {
    if (!compounds || compounds.length === 0) return []
    return compounds.map((compound) => ({
      value: compound.id,
      label: compound.name,
      description: `${compound.area || compound.city || ''}, ${compound.country}`,
    }))
  }, [compounds])

  const updateUserMutation = useMutation({
    mutationFn: async (compoundId: number) => {
      // Update user's compound via API
      const response = await api.patch('/api/auth/me', { compound_id: compoundId })
      return { compoundId, userData: response.data }
    },
    onSuccess: (data) => {
      // Only redirect to verification after successful compound selection
      // Verify the compound was actually set
      if (data.userData?.compound_id || data.compoundId) {
        router.push('/verification')
      } else {
        setError('Compound selection failed. Please try again.')
      }
    },
    onError: (err: any) => {
      // Don't redirect on error - show error message instead
      const errorMessage = err.response?.data?.detail || 'Failed to update compound. Please try again.'
      setError(errorMessage)
      console.error('Compound selection error:', err)
    },
  })

  const handleSubmit = () => {
    if (!selectedCompoundId) {
      setError('Please select a compound')
      return
    }
    setError('')
    updateUserMutation.mutate(selectedCompoundId)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading compounds...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Select Your Compound</CardTitle>
            <CardDescription>
              Search and select the compound or neighborhood where you live
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="compound-select">Compound</Label>
              <Combobox
                options={compoundOptions}
                value={selectedCompoundId}
                onValueChange={(value) => {
                  setSelectedCompoundId(value as number | null)
                  setError('')
                }}
                placeholder="Search for your compound..."
                searchPlaceholder="Type to search compounds..."
                emptyMessage="No compounds found. Try a different search."
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Start typing to search through {compoundsData?.total || 0} available compounds
              </p>
            </div>

            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={!selectedCompoundId || updateUserMutation.isPending}
              size="lg"
            >
              {updateUserMutation.isPending ? 'Saving...' : 'Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

