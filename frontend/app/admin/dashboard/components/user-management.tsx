'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
      return 'bg-blue-100 text-blue-800'
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
  }

  const hasActiveFilters =
    debouncedSearch || roleFilter !== 'ALL' || statusFilter !== 'ALL' || compoundFilter || sortBy !== 'created_at_desc'

  const rangeStart = total === 0 ? 0 : page * pageSize + 1
  const rangeEnd = Math.min((page + 1) * pageSize, total)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by ID, name, email, or phone…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 pr-10"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
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
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              {total} user{total !== 1 ? 's' : ''}
              {isFetching && !isLoading && ' · Updating…'}
            </span>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
            )}
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
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Phone</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Compound</th>
                    <th className="px-4 py-3 font-medium hidden lg:table-cell">Joined</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50/80">
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
