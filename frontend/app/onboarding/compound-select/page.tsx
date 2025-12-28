'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import api from '@/lib/api'
import Cookies from 'js-cookie'

interface Compound {
  id: number
  name: string
  city: string
  country: string
}

export default function CompoundSelectPage() {
  const router = useRouter()
  const [selectedCompound, setSelectedCompound] = useState<number | null>(null)
  const [error, setError] = useState('')

  const { data: compounds, isLoading } = useQuery<Compound[]>({
    queryKey: ['compounds'],
    queryFn: async () => {
      const response = await api.get('/api/compounds')
      return response.data
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: async (compoundId: number) => {
      // In a real app, you'd have an endpoint to update user's compound
      // For now, we'll just proceed to verification
      return { compoundId }
    },
    onSuccess: () => {
      router.push('/verification')
    },
  })

  const handleSubmit = () => {
    if (!selectedCompound) {
      setError('Please select a compound')
      return
    }
    updateUserMutation.mutate(selectedCompound)
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Select Your Compound</CardTitle>
            <CardDescription>Choose the compound or neighborhood where you live</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm mb-4">
                {error}
              </div>
            )}
            <div className="space-y-2 mb-6">
              {compounds?.map((compound) => (
                <button
                  key={compound.id}
                  onClick={() => setSelectedCompound(compound.id)}
                  className={`w-full text-left p-4 border rounded-lg transition-colors ${
                    selectedCompound === compound.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">{compound.name}</div>
                  <div className="text-sm text-gray-600">
                    {compound.city}, {compound.country}
                  </div>
                </button>
              ))}
            </div>
            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={!selectedCompound || updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? 'Saving...' : 'Continue'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

