'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import api from '@/lib/api'
import { formatCompoundName } from '@/lib/format-compound'

interface CompoundInvite {
  compound_id: number
  compound_name: string
  compound_area?: string | null
}

export function CompoundInviteBanner() {
  const { user, isAuthenticated, refreshUser } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: invites = [] } = useQuery({
    queryKey: ['compound-invites', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/auth/me/compound-invites')
      return (response.data || []) as CompoundInvite[]
    },
    enabled: !!isAuthenticated && !!user,
    staleTime: 30_000,
  })

  const confirmMutation = useMutation({
    mutationFn: async (compoundId: number) => {
      await api.post(`/api/auth/me/compound-invites/${compoundId}/confirm`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['compound-invites'] })
      await refreshUser()
      toast({ title: 'Joined compound', description: 'Your chat-import invite was confirmed.' })
    },
    onError: (error: any) => {
      toast({
        title: 'Could not confirm invite',
        description: error?.response?.data?.detail || error.message,
        variant: 'destructive',
      })
    },
  })

  const declineMutation = useMutation({
    mutationFn: async (compoundId: number) => {
      await api.post(`/api/auth/me/compound-invites/${compoundId}/decline`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['compound-invites'] })
      toast({ title: 'Invite declined' })
    },
  })

  if (!invites.length) return null

  return (
    <div className="mb-4 space-y-3">
      {invites.map((invite) => (
        <div
          key={invite.compound_id}
          className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-secondary/60 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Join {formatCompoundName(invite.compound_name)}?
              </p>
              <p className="text-sm text-muted-foreground">
                You were invited from the compound group chat. Confirm to unlock community access.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate(invite.compound_id)}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={declineMutation.isPending}
              onClick={() => declineMutation.mutate(invite.compound_id)}
            >
              Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
