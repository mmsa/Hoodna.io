'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Shield, 
  MessageSquare, 
  Ban, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  User, 
  Calendar,
  Loader2,
  Search,
  RefreshCw
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { formatCompoundName } from '@/lib/format-compound'
import Link from 'next/link'

interface Post {
  id: number
  title: string
  content: string
  author_id: number
  author_name: string
  compound_id: number
  compound_name: string
  created_at: string
  deleted_at: string | null
}

interface Report {
  id: number
  reporter_id: number
  reporter_name: string
  reported_type: string
  reported_id: number
  reason: string
  description: string
  status: string
  created_at: string
  post?: Post
}

interface User {
  id: number
  name: string
  email: string
  role: string
  status: string
  compound_id: number
}

export default function ModeratorDashboardPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('reports')
  const [searchQuery, setSearchQuery] = useState('')
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [banReason, setBanReason] = useState('')

  // Fetch moderator profile to get compound name
  const { data: moderatorProfile } = useQuery({
    queryKey: ['moderator-profile'],
    queryFn: async () => {
      const response = await api.get('/api/moderators/me')
      return response.data
    },
    enabled: !!user && user.role === 'COMPOUND_MOD',
    retry: false,
  })

  const compoundName = moderatorProfile?.compound_name 
    ? formatCompoundName(moderatorProfile.compound_name) 
    : 'your compound'

  // Check if user is moderator
  if (!user || user.role !== 'COMPOUND_MOD') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-600">Access denied. Moderator only.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const moderatorCompoundId = moderatorProfile?.compound_id ?? user?.compound_id

  // Fetch reports
  const { data: reports, isLoading: reportsLoading, refetch: refetchReports } = useQuery<Report[]>({
    queryKey: ['moderator-reports', moderatorCompoundId],
    queryFn: async () => {
      const response = await api.get(`/api/reports?status_filter=PENDING`)
      return response.data || []
    },
    enabled: !!moderatorCompoundId,
  })

  // Fetch posts from compound
  const { data: posts, isLoading: postsLoading, refetch: refetchPosts } = useQuery<Post[]>({
    queryKey: ['moderator-posts', moderatorCompoundId],
    queryFn: async () => {
      const response = await api.get(`/api/posts?compound_id=${moderatorCompoundId}`)
      return response.data || []
    },
    enabled: !!moderatorCompoundId,
  })

  // Note: User management endpoint doesn't exist yet, so we'll show a message
  const users: User[] = []
  const usersLoading = false

  // Hide post mutation
  const hidePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      await api.delete(`/api/moderator/posts/${postId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderator-posts'] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      toast({
        title: 'Post hidden',
        description: 'The post has been hidden successfully',
        variant: 'success',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.detail || 'Failed to hide post',
        variant: 'destructive',
      })
    },
  })

  // Restore post mutation
  const restorePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      await api.post(`/api/moderator/posts/${postId}/restore`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderator-posts'] })
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      toast({
        title: 'Post restored',
        description: 'The post has been restored successfully',
        variant: 'success',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.detail || 'Failed to restore post',
        variant: 'destructive',
      })
    },
  })

  // Ban user mutation
  const banUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      await api.post(`/api/moderator/users/${userId}/ban`, { reason })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderator-users'] })
      setBanDialogOpen(false)
      setSelectedUser(null)
      setBanReason('')
      toast({
        title: 'User banned',
        description: 'The user has been banned successfully',
        variant: 'success',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.detail || 'Failed to ban user',
        variant: 'destructive',
      })
    },
  })

  // Resolve report mutation
  const resolveReportMutation = useMutation({
    mutationFn: async ({ reportId, status }: { reportId: number; status: string }) => {
      await api.patch(`/api/reports/${reportId}`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderator-reports'] })
      toast({
        title: 'Report resolved',
        description: 'The report has been marked as resolved',
        variant: 'success',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.response?.data?.detail || 'Failed to resolve report',
        variant: 'destructive',
      })
    },
  })

  const handleBanUser = (userToBan: User) => {
    setSelectedUser(userToBan)
    setBanDialogOpen(true)
  }

  const confirmBan = () => {
    if (selectedUser) {
      banUserMutation.mutate({ userId: selectedUser.id, reason: banReason || 'Moderator action' })
    }
  }

  const filteredReports = reports?.filter((report) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      report.reporter_name?.toLowerCase().includes(query) ||
      report.reason?.toLowerCase().includes(query) ||
      report.description?.toLowerCase().includes(query)
    )
  }) || []

  const filteredPosts = posts?.filter((post) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      post.title?.toLowerCase().includes(query) ||
      post.content?.toLowerCase().includes(query) ||
      post.author_name?.toLowerCase().includes(query)
    )
  }) || []

  const filteredUsers = users?.filter((userItem) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      userItem.name?.toLowerCase().includes(query) ||
      userItem.email?.toLowerCase().includes(query)
    )
  }) || []

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              Moderator Dashboard
            </h1>
            <p className="text-gray-600">Manage content and users in {compoundName}</p>
          </div>
          <Link href="/feed">
            <Button variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search reports, posts, or users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Reports ({filteredReports.length})
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Posts ({filteredPosts.length})
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Users ({filteredUsers.length})
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Pending Reports</CardTitle>
                <CardDescription>Review and resolve user reports</CardDescription>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No pending reports</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredReports.map((report) => (
                      <Card key={report.id} className="border-l-4 border-l-yellow-500">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{report.reason}</Badge>
                                <span className="text-sm text-gray-500">
                                  Reported by {report.reporter_name}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {new Date(report.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-gray-700 mb-2">{report.description}</p>
                              {report.post && (
                                <div className="mt-2 p-2 bg-gray-50 rounded">
                                  <p className="text-sm font-semibold">{report.post.title}</p>
                                  <p className="text-sm text-gray-600 line-clamp-2">{report.post.content}</p>
                                  <Link href={`/feed`} className="text-sm text-primary hover:underline mt-1 inline-block">
                                    View Post →
                                  </Link>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => resolveReportMutation.mutate({ reportId: report.id, status: 'RESOLVED' })}
                                disabled={resolveReportMutation.isPending}
                              >
                                Resolve
                              </Button>
                              {report.post && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => hidePostMutation.mutate(report.post!.id)}
                                  disabled={hidePostMutation.isPending}
                                >
                                  <EyeOff className="w-4 h-4 mr-1" />
                                  Hide Post
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Posts Tab */}
          <TabsContent value="posts" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Compound Posts</CardTitle>
                <CardDescription>Manage posts in {compoundName}</CardDescription>
              </CardHeader>
              <CardContent>
                {postsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No posts found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredPosts.map((post) => (
                      <Card key={post.id} className={post.deleted_at ? 'opacity-60' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{post.title}</h3>
                                {post.deleted_at && (
                                  <Badge variant="destructive">Hidden</Badge>
                                )}
                              </div>
                              <p className="text-gray-600 text-sm mb-2 line-clamp-2">{post.content}</p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>By {post.author_name}</span>
                                <span>{new Date(post.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              {post.deleted_at ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => restorePostMutation.mutate(post.id)}
                                  disabled={restorePostMutation.isPending}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Restore
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to hide this post?')) {
                                      hidePostMutation.mutate(post.id)
                                    }
                                  }}
                                  disabled={hidePostMutation.isPending}
                                >
                                  <EyeOff className="w-4 h-4 mr-1" />
                                  Hide
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Compound Users</CardTitle>
                <CardDescription>Manage users in {compoundName}</CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : !users ? (
                  <div className="text-center py-12">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">User management coming soon</p>
                    <p className="text-sm text-gray-500 mt-2">You can ban users directly from posts in the feed</p>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No users found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredUsers.map((userItem) => (
                      <Card key={userItem.id} className={userItem.status === 'BANNED' ? 'opacity-60 border-red-200' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{userItem.name}</h3>
                                {userItem.status === 'BANNED' && (
                                  <Badge variant="destructive">Banned</Badge>
                                )}
                                <Badge variant="outline">{userItem.role}</Badge>
                              </div>
                              <p className="text-sm text-gray-500">{userItem.email}</p>
                            </div>
                            {userItem.status !== 'BANNED' && userItem.id !== user.id && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleBanUser(userItem)}
                                disabled={banUserMutation.isPending}
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                Ban User
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Ban User Dialog */}
        <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ban User</DialogTitle>
              <DialogDescription>
                Are you sure you want to ban {selectedUser?.name}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Reason (optional)</label>
                <Textarea
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Enter reason for banning this user..."
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmBan}
                disabled={banUserMutation.isPending}
              >
                {banUserMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Banning...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    Ban User
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
