'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Star, X } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { formatCompoundWithArea } from '@/lib/format-compound'

type Compound = { id: number; name: string; area?: string | null }

interface AdminUserCompoundManagerProps {
  userId: number
  userStatus: string
  primaryCompoundId?: number | null
  memberships: Array<{
    compound_id: number
    compound_name?: string | null
    compound_area?: string | null
    is_verified?: boolean
    verification_status?: string
  }>
  onUpdated?: () => void
}

export function AdminUserCompoundManager({
  userId,
  userStatus,
  primaryCompoundId,
  memberships,
  onUpdated,
}: AdminUserCompoundManagerProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [primaryId, setPrimaryId] = useState<number | null>(null)
  const [approveUser, setApproveUser] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const verifiedIds = memberships
      .filter((m) => m.is_verified ?? m.verification_status === 'VERIFIED')
      .map((m) => m.compound_id)
    setSelectedIds(verifiedIds)
    setPrimaryId(
      primaryCompoundId && verifiedIds.includes(primaryCompoundId)
        ? primaryCompoundId
        : verifiedIds[0] ?? null
    )
    setApproveUser(false)
  }, [memberships, primaryCompoundId, userId])

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(handle)
  }, [search])

  const { data: compoundsData, isLoading: loadingCompounds, isError: compoundsError } = useQuery({
    queryKey: ['admin-compounds-search', debouncedSearch],
    queryFn: async () => {
      const response = await api.get('/api/admin/compounds', {
        params: {
          limit: 200,
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
        },
      })
      return (response.data.items || []) as Compound[]
    },
  })

  const compounds = useMemo(() => {
    const byId = new Map<number, Compound>()
    for (const membership of memberships) {
      byId.set(membership.compound_id, {
        id: membership.compound_id,
        name: membership.compound_name || `Compound ${membership.compound_id}`,
        area: membership.compound_area,
      })
    }
    for (const compound of compoundsData || []) {
      byId.set(compound.id, compound)
    }
    return [...byId.values()]
  }, [compoundsData, memberships])

  const filteredCompounds = compoundsData || []

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await api.put(`/api/admin/users/${userId}/compounds`, {
        compound_ids: selectedIds,
        primary_compound_id: primaryId ?? undefined,
        approve_user: approveUser,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast({ title: 'Compounds updated', description: 'User neighbourhood access saved.' })
      onUpdated?.()
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save',
        description: error.response?.data?.detail || error.message || 'Could not update compounds',
        variant: 'destructive',
      })
    },
  })

  function toggleCompound(compoundId: number) {
    setSelectedIds((prev) => {
      if (prev.includes(compoundId)) {
        const next = prev.filter((id) => id !== compoundId)
        if (primaryId === compoundId) {
          setPrimaryId(next[0] ?? null)
        }
        return next
      }
      const next = [...prev, compoundId]
      if (primaryId == null) setPrimaryId(compoundId)
      return next
    })
  }

  const selectedCompounds = selectedIds
    .map((id) => compounds.find((c) => c.id === id))
    .filter(Boolean) as Compound[]

  return (
    <section className="border rounded-lg p-4 bg-slate-50/80 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Neighbourhood access</h3>
        <p className="text-xs text-gray-500 mt-1">
          Assign one or more compounds. The starred compound is the user&apos;s active neighbourhood.
        </p>
      </div>

      {selectedCompounds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedCompounds.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-sm bg-white border border-gray-200"
            >
              <button
                type="button"
                title="Set as primary"
                onClick={() => setPrimaryId(c.id)}
                className={primaryId === c.id ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}
              >
                <Star className="w-3.5 h-3.5" fill={primaryId === c.id ? 'currentColor' : 'none'} />
              </button>
              <span>{formatCompoundWithArea(c.name, c.area ?? undefined)}</span>
              <button
                type="button"
                onClick={() => toggleCompound(c.id)}
                className="p-0.5 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">No compounds assigned</p>
      )}

      <Input
        placeholder="Search compounds to add…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="max-h-40 overflow-y-auto border rounded-md bg-white divide-y">
        {loadingCompounds ? (
          <div className="p-4 text-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Loading compounds…
          </div>
        ) : compoundsError ? (
          <p className="p-3 text-sm text-red-600">Could not load compounds. Refresh and try again.</p>
        ) : filteredCompounds.length === 0 ? (
          <p className="p-3 text-sm text-gray-500">No compounds match your search</p>
        ) : (
          filteredCompounds.slice(0, 50).map((c) => {
            const checked = selectedIds.includes(c.id)
            return (
              <label
                key={c.id}
                className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCompound(c.id)}
                  className="rounded border-gray-300"
                />
                <span className="flex-1">{formatCompoundWithArea(c.name, c.area ?? undefined)}</span>
                <span className="text-xs text-gray-400">ID {c.id}</span>
              </label>
            )
          })
        )}
      </div>

      {userStatus !== 'APPROVED' && selectedIds.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={approveUser}
            onChange={(e) => setApproveUser(e.target.checked)}
            className="rounded border-gray-300"
          />
          Also approve user account
        </label>
      )}

      <Button
        type="button"
        size="sm"
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving…
          </>
        ) : (
          'Save neighbourhood access'
        )}
      </Button>
    </section>
  )
}
