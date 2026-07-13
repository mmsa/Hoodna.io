'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, Plus, CheckCircle2, Clock } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { isVerifiedForCurrentCompound } from '@/lib/resident-routing'
import { formatCompoundWithArea } from '@/lib/format-compound'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CompoundOption = {
  id: number
  name: string
  area: string | null
  is_current: boolean
  is_verified: boolean
}

export function VerificationCompoundBar({
  currentCompoundName,
  currentCompoundArea,
  onCompoundChange,
}: {
  currentCompoundName?: string | null
  currentCompoundArea?: string | null
  onCompoundChange?: () => void
}) {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [compounds, setCompounds] = useState<CompoundOption[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  const loadCompounds = useCallback(async () => {
    try {
      const response = await api.get('/api/auth/me/compounds')
      let list: CompoundOption[] = (response.data || []).map((c: CompoundOption) => ({
        ...c,
        is_verified: c.is_verified ?? true,
      }))

      if (user?.compound_id && !list.some((c) => c.id === user.compound_id)) {
        try {
          const compoundsRes = await api.get('/api/compounds?limit=200')
          const all = compoundsRes.data?.items || compoundsRes.data || []
          const current = all.find((c: { id: number }) => c.id === user.compound_id)
          if (current) {
            list.push({
              id: current.id,
              name: current.name,
              area: current.area ?? null,
              is_current: true,
              is_verified: false,
            })
          }
        } catch {
          // ignore
        }
      }

      list.sort((a, b) => Number(b.is_current) - Number(a.is_current))
      setCompounds(list)
    } catch {
      setCompounds([])
    } finally {
      setLoading(false)
    }
  }, [user?.compound_id])

  useEffect(() => {
    loadCompounds()
  }, [loadCompounds])

  const currentCompound = compounds.find((c) => c.is_current)
  const displayName =
    currentCompoundName ||
    currentCompound?.name ||
    (user?.compound_id ? `Neighbourhood #${user.compound_id}` : null)
  const displayArea = currentCompoundArea ?? currentCompound?.area ?? undefined

  const showDropdown = compounds.length > 1
  const selectValue = user?.compound_id != null ? String(user.compound_id) : undefined

  async function handleSwitch(compoundId: number) {
    const target = compounds.find((c) => c.id === compoundId)
    if (!target || compoundId === user?.compound_id || switching) return

    setSwitching(true)
    try {
      if (target.is_verified) {
        await api.post('/api/auth/me/switch-compound', { compound_id: compoundId })
        await refreshUser()
        router.replace('/feed')
      } else {
        await api.patch('/api/auth/me', { compound_id: compoundId })
        await refreshUser()
        await loadCompounds()
        onCompoundChange?.()
      }
    } finally {
      setSwitching(false)
    }
  }

  const verifyingNewCompound =
    user?.compound_id != null && user && !isVerifiedForCurrentCompound(user)

  return (
    <div className="space-y-3 mb-6">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
          <Building2 className="w-4 h-4 text-primary" />
          {verifyingNewCompound ? 'Verifying for' : 'Neighbourhood'}
        </div>

        {loading ? (
          <div className="h-10 flex items-center text-sm text-muted-foreground">Loading…</div>
        ) : showDropdown ? (
          <Select
            value={selectValue}
            onValueChange={(value) => handleSwitch(Number(value))}
            disabled={switching}
          >
            <SelectTrigger className="h-auto py-2 text-left border-border bg-secondary/50">
              <SelectValue placeholder="Select neighbourhood">
                <span className="font-semibold text-gray-900">
                  {displayName
                    ? formatCompoundWithArea(displayName, displayArea)
                    : 'Select neighbourhood'}
                </span>
              </SelectValue>
              <ChevronDown className="h-4 w-4 text-primary shrink-0" />
            </SelectTrigger>
            <SelectContent>
              {compounds.map((compound) => (
                <SelectItem key={compound.id} value={String(compound.id)}>
                  <div className="flex items-center gap-2">
                    {compound.is_verified ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-medium">
                        {formatCompoundWithArea(compound.name, compound.area ?? undefined)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {compound.is_verified ? 'Verified' : 'Verifying'}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-xl font-semibold text-gray-900">
            {displayName
              ? formatCompoundWithArea(displayName, displayArea)
              : 'Your neighbourhood'}
          </p>
        )}

        {verifyingNewCompound && (
          <p className="text-sm text-muted-foreground mt-2">
            Documents are stored per neighbourhood. Upload new documents here — verified
            neighbourhoods stay separate.
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-primary"
        onClick={() => router.push('/onboarding/compound-select')}
      >
        <Plus className="w-4 h-4 mr-1" />
        Add another neighbourhood
      </Button>
    </div>
  )
}
