'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Ban,
  CheckCircle,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  Loader2,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { formatUserRole, formatUserStatus } from '@/lib/format-enums'
import UserDetailDialog from './user-detail-dialog'

interface AdminUser {
  id: number
  name: string
  email: string
  phone?: string
  role?: string
  status: string
  compound_id?: number
  compound_name?: string
  created_at: string
  creation_source?: string | null
  creation_details?: Record<string, unknown> | null
  creation_job_id?: number | null
  creation_note?: string | null
}

interface AdminUserListResponse {
  items: AdminUser[]
  total: number
  skip: number
  limit: number
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function statusBadgeClass(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800'
    case 'REJECTED':
      return 'bg-red-100 text-red-800'
    case 'BANNED':
      return 'bg-gray-800 text-white'
    default:
      return 'bg-secondary text-primary'
  }
}

function buildPageNumbers(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i)
  }
  const pages: (number | 'ellipsis')[] = [0]
  const start = Math.max(1, current - 1)
  const end = Math.min(totalPages - 2, current + 1)
  if (start > 1) pages.push('ellipsis')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < totalPages - 2) pages.push('ellipsis')
  pages.push(totalPages - 1)
  return pages
}

export default function UserManagement() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [compoundFilter, setCompoundFilter] = useState('')
  const [sortBy, setSortBy] = useState('created_at_desc')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const [detailUserId, setDetailUserId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
      setPage(0)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  const compoundId = compoundFilter.trim() && /^\d+$/.test(compoundFilter.trim())
    ? parseInt(compoundFilter.trim(), 10)
    : undefined

  useEffect(() => {
    setSelectedIds(new Set())
  }, [debouncedSearch, roleFilter, statusFilter, compoundId, sortBy, page, pageSize])

  const { data, isLoading, isFetching, refetch } = useQuery<AdminUserListResponse>({
    queryKey: ['admin-users', debouncedSearch, roleFilter, statusFilter, compoundId, sortBy, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        skip: String(page * pageSize),
        limit: String(pageSize),
        sort_by: sortBy,
      })
      if (debouncedSearch) params.append('search', debouncedSearch)
      if (roleFilter !== 'ALL') params.append('role_filter', roleFilter)
      if (statusFilter !== 'ALL') params.append('status_filter', statusFilter)
      if (compoundId) params.append('compound_id', String(compoundId))
      const response = await api.get(`/api/admin/users?${params.toString()}`)
      return response.data
    },
  })

  const users = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageNumbers = useMemo(() => buildPageNumbers(page, totalPages), [page, totalPages])
  const pageIds = useMemo(() => users.map((u) => u.id), [users])
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const somePageSelected = pageIds.some((id) => selectedIds.has(id))
  const selectedCount = selectedIds.size

  const toggleSelectAllPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        pageIds.forEach((id) => next.add(id))
      } else {
        pageIds.forEach((id) => next.delete(id))
      }
      return next
    })
  }

  const toggleSelectOne = (userId: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    queryClient.invalidateQueries({ queryKey: ['admin-user-detail'] })
    refetch()
  }

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ email, new_password }: { email: string; new_password: string }) => {
      const response = await api.post('/api/admin/users/reset-password', { email, new_password })
      return response.data
    },
    onSuccess: () => {
      setResetDialogOpen(false)
      setNewPassword('')
      setSelectedUser(null)
      toast.success('Password updated')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to reset password')
    },
  })

  const statusMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: number; action: 'approve' | 'reject' | 'ban' }) => {
      const response = await api.post(`/api/admin/users/${userId}/${action}`, {})
      return response.data
    },
    onSuccess: (_, { action }) => {
      toast.success(`User ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'banned'}`)
      invalidate()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Action failed')
    },
  })

  const bulkStatusMutation = useMutation({
    mutationFn: async ({
      userIds,
      action,
    }: {
      userIds: number[]
      action: 'approve' | 'reject' | 'ban' | 'delete'
    }) => {
      const results = await Promise.allSettled(
        userIds.map((userId) =>
          action === 'delete'
            ? api.delete(`/api/admin/users/${userId}`)
            : api.post(`/api/admin/users/${userId}/${action}`, {})
        )
      )
      const succeeded = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - succeeded
      return { succeeded, failed, action, total: results.length }
    },
    onSuccess: ({ succeeded, failed, action }) => {
      const verb =
        action === 'approve'
          ? 'approved'
          : action === 'reject'
            ? 'rejected'
            : action === 'ban'
              ? 'banned'
              : 'deleted'
      if (failed === 0) {
        toast.success(`${succeeded} user${succeeded === 1 ? '' : 's'} ${verb}`)
      } else {
        toast.error(`${succeeded} ${verb}, ${failed} failed`)
      }
      setSelectedIds(new Set())
      invalidate()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Bulk action failed')
    },
  })

  const runBulkAction = (action: 'approve' | 'reject' | 'ban' | 'delete') => {
    const userIds = Array.from(selectedIds)
    if (userIds.length === 0) return
    const label =
      action === 'approve'
        ? 'Approve'
        : action === 'reject'
          ? 'Reject'
          : action === 'ban'
            ? 'Ban'
            : 'Permanently delete'
    const confirmMsg =
      action === 'delete'
        ? `Permanently delete ${userIds.length} selected user${userIds.length === 1 ? '' : 's'} and their content? This cannot be undone.`
        : `${label} ${userIds.length} selected user${userIds.length === 1 ? '' : 's'}?`
    if (!window.confirm(confirmMsg)) {
      return
    }
    bulkStatusMutation.mutate({ userIds, action })
  }

  const deleteMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await api.delete(`/api/admin/users/${userId}`)
      return response.data
    },
    onSuccess: () => {
      toast.success('User deleted')
      invalidate()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete user')
    },
  })

  const openDetail = (user: AdminUser) => {
    setDetailUserId(user.id)
    setDetailOpen(true)
  }

  const openResetDialog = (user: Pick<AdminUser, 'id' | 'name' | 'email'>) => {
    setSelectedUser(user as AdminUser)
    setNewPassword('')
    setResetDialogOpen(true)
  }

  const confirmResetPassword = () => {
    if (!selectedUser || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    resetPasswordMutation.mutate({ email: selectedUser.email, new_password: newPassword })
  }

  const resetFilters = () => {
    setSearchInput('')
    setDebouncedSearch('')
    setRoleFilter('ALL')
    setStatusFilter('ALL')
    setCompoundFilter('')
    setSortBy('created_at_desc')
    setPage(0)
    setSelectedIds(new Set())
  }

  const hasActiveFilters =
    debouncedSearch || roleFilter !== 'ALL' || statusFilter !== 'ALL' || compoundFilter || sortBy !== 'created_at_desc'

  const rangeStart = total === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min((page + 1) * pageSize, total)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="space-y-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <Input
                placeholder="Search by ID, name, email, or phone…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-10"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0) }}>
                <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  <SelectItem value="RESIDENT">Resident</SelectItem>
                  <SelectItem value="USER">User (legacy)</SelectItem>
                  <SelectItem value="SERVICE_PROVIDER">Service provider</SelectItem>
                  <SelectItem value="COMPOUND_MOD">Compound mod</SelectItem>
                  <SelectItem value="MODERATOR">Moderator</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All status</SelectItem>
                  <SelectItem value="PENDING_VERIFICATION">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="BANNED">Banned</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Compound ID"
                value={compoundFilter}
                onChange={(e) => { setCompoundFilter(e.target.value); setPage(0) }}
              />
              <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0) }}>
                <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">Newest first</SelectItem>
                  <SelectItem value="created_at_asc">Oldest first</SelectItem>
                  <SelectItem value="name_asc">Name A–Z</SelectItem>
                  <SelectItem value="name_desc">Name Z–A</SelectItem>
                  <SelectItem value="email_asc">Email A–Z</SelectItem>
                  <SelectItem value="email_desc">Email Z–A</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => { setPageSize(parseInt(v, 10)); setPage(0) }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">
            <span>
              {total} user{total !== 1 ? 's' : ''}
              {selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
              {isFetching && !isLoading && ' · Updating…'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {selectedCount > 0 ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-700"
                    disabled={bulkStatusMutation.isPending}
                    onClick={() => runBulkAction('approve')}
                  >
                    {bulkStatusMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-700"
                    disabled={bulkStatusMutation.isPending}
                    onClick={() => runBulkAction('reject')}
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkStatusMutation.isPending}
                    onClick={() => runBulkAction('ban')}
                  >
                    <Ban className="h-4 w-4" />
                    Ban
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={bulkStatusMutation.isPending}
                    onClick={() => runBulkAction('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={bulkStatusMutation.isPending}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear selection
                  </Button>
                </>
              ) : null}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p>Loading users…</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-600">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-gray-600">
                    <th className="px-3 py-3 w-10">
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                        onCheckedChange={(value) => toggleSelectAllPage(value === true)}
                        aria-label="Select all on this page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Phone</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Compound</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">How added</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={`border-b last:border-0 hover:bg-gray-50/80 ${
                        selectedIds.has(user.id) ? 'bg-secondary/40' : ''
                      }`}
                    >
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onCheckedChange={(value) => toggleSelectOne(user.id, value === true)}
                          aria-label={`Select user ${user.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{user.id}</td>
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3 text-gray-700">{user.email}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">{user.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{formatUserRole(user.role)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${statusBadgeClass(user.status)}`}>
                          {formatUserStatus(user.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                        {user.compound_name || (user.compound_id ? `#${user.compound_id}` : '—')}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600 max-w-[220px]">
                        <span className="line-clamp-2" title={user.creation_note || undefined}>
                          {user.creation_note || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(user)} title="View details">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openResetDialog(user)} title="Reset password">
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          {user.status !== 'APPROVED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-700"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ userId: user.id, action: 'approve' })}
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {user.status !== 'REJECTED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-700"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ userId: user.id, action: 'reject' })}
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {user.status !== 'BANNED' && user.role !== 'ADMIN' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={statusMutation.isPending}
                              onClick={() => statusMutation.mutate({ userId: user.id, action: 'ban' })}
                              title="Ban"
                            >
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                          {user.role !== 'ADMIN' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deleteMutation.isPending || bulkStatusMutation.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Permanently delete ${user.name} and their content? This cannot be undone.`
                                  )
                                ) {
                                  deleteMutation.mutate(user.id)
                                }
                              }}
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            Showing {rangeStart}–{rangeEnd} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(0)}>
              <ChevronFirst className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {pageNumbers.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-2 text-gray-400">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-9"
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(totalPages - 1)}
            >
              <ChevronLast className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <UserDetailDialog
        userId={detailUserId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onResetPassword={openResetDialog}
        onStatusAction={(userId, action) => statusMutation.mutate({ userId, action })}
        statusActionPending={statusMutation.isPending}
        onUserUpdated={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })}
      />

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.name} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmResetPassword} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? 'Saving…' : 'Update password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
