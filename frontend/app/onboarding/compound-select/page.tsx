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
  city: string
  country: string
}

export default function CompoundSelectPage() {
  const router = useRouter()
  const [selectedCompoundId, setSelectedCompoundId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const { data: compounds, isLoading } = useQuery<Compound[]>({
    queryKey: ['compounds'],
    queryFn: async () => {
      const response = await api.get('/api/compounds')
      return response.data
    },
  })

  // Transform compounds to combobox options
  const compoundOptions: ComboboxOption[] = useMemo(() => {
    if (!compounds) return []
    return compounds.map((compound) => ({
      value: compound.id,
      label: compound.name,
      description: `${compound.city}, ${compound.country}`,
    }))
  }, [compounds])

  const updateUserMutation = useMutation({
    mutationFn: async (compoundId: number) => {
      // Update user's compound via API
      await api.patch('/api/auth/me', { compound_id: compoundId })
      return { compoundId }
    },
    onSuccess: () => {
      router.push('/verification')
    },
    onError: (err: any) => {
      // If endpoint doesn't exist yet, just proceed
      if (err.response?.status === 404) {
        router.push('/verification')
      } else {
        setError(err.response?.data?.detail || 'Failed to update compound')
      }
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
                Start typing to search through {compounds?.length || 0} available compounds
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

