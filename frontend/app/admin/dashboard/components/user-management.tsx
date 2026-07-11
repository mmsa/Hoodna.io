'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CheckCircle,
  XCircle,
  Ban,
  KeyRound,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'sonner'
import { formatUserRole, formatUserStatus } from '@/lib/format-enums'

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

const PAGE_SIZE = 25

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

export default function UserManagement() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [page, setPage] = useState(0)

  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const { data, isLoading, refetch } = useQuery<AdminUserListResponse>({
    queryKey: ['admin-users', searchQuery, roleFilter, statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        skip: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      })
      if (searchQuery.trim()) params.append('search', searchQuery.trim())
      if (roleFilter !== 'ALL') params.append('role_filter', roleFilter)
      if (statusFilter !== 'ALL') params.append('status_filter', statusFilter)
      const response = await api.get(`/api/admin/users?${params.toString()}`)
      return response.data
    },
  })

  const users = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] })
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

  const openResetDialog = (user: AdminUser) => {
    setSelectedUser(user)
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

  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value)
    setPage(0)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setPage(0)
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-44">
              <Select value={roleFilter} onValueChange={(v) => handleFilterChange(setRoleFilter, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="RESIDENT">Resident</SelectItem>
                  <SelectItem value="USER">User (legacy)</SelectItem>
                  <SelectItem value="SERVICE_PROVIDER">Service Provider</SelectItem>
                  <SelectItem value="COMPOUND_MOD">Compound Mod</SelectItem>
                  <SelectItem value="MODERATOR">Moderator</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-44">
              <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="PENDING_VERIFICATION">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="BANNED">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            <p>Loading users...</p>
          </CardContent>
        </Card>
      ) : users.length > 0 ? (
        <>
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{user.name}</CardTitle>
                      <CardDescription className="space-y-0.5">
                        <span className="block">{user.email}</span>
                        {user.phone && <span className="block">{user.phone}</span>}
                        {user.compound_name && <span className="block">{user.compound_name}</span>}
                        <span className="block text-xs text-gray-400">
                          Joined {new Date(user.created_at).toLocaleDateString()} · ID {user.id}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {formatUserRole(user.role)}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass(user.status)}`}>
                        {formatUserStatus(user.status)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openResetDialog(user)}>
                      <KeyRound className="w-3 h-3 mr-1" />
                      Reset Password
                    </Button>
                    {user.status !== 'APPROVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-700 border-green-200 hover:bg-green-50"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ userId: user.id, action: 'approve' })}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                    )}
                    {user.status !== 'REJECTED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-700 border-red-200 hover:bg-red-50"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ userId: user.id, action: 'reject' })}
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Reject
                      </Button>
                    )}
                    {user.status !== 'BANNED' && user.role !== 'ADMIN' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-700 border-gray-300 hover:bg-gray-50"
                        disabled={statusMutation.isPending}
                        onClick={() => statusMutation.mutate({ userId: user.id, action: 'ban' })}
                      >
                        <Ban className="w-3 h-3 mr-1" />
                        Ban
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-gray-600">No users found</CardContent>
        </Card>
      )}

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
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
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmResetPassword} disabled={resetPasswordMutation.isPending}>
              {resetPasswordMutation.isPending ? 'Saving...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
