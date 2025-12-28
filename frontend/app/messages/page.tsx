'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import Link from 'next/link'
import {
  MessageCircle,
  Send,
  ShoppingBag,
  User,
  ArrowRight,
  Calendar,
  Inbox,
  Sparkles,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useRouter } from 'next/navigation'

interface Conversation {
  id: number
  other_user_id: number
  other_user_name: string
  listing_id?: number
  listing_title?: string
  last_message?: {
    id: number
    content: string
    sender_name: string
    created_at: string
  }
  unread_count: number
  updated_at: string
}

function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default function MessagesPage() {
  const router = useRouter()
  const { user } = useAuth()

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const response = await api.get('/api/conversations')
      return response.data
    },
    refetchInterval: 10000, // Poll every 10 seconds for new messages
  })

  const unreadCount = conversations?.reduce((sum, conv) => sum + (conv.unread_count || 0), 0) || 0
  const hasUnread = unreadCount > 0

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Enhanced Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Messages
                </h1>
                {hasUnread && (
                  <span className="px-3 py-1 bg-red-500 text-white text-sm font-bold rounded-full animate-pulse">
                    {unreadCount} {unreadCount === 1 ? 'unread' : 'unread'}
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-1">
                Connect with your neighbors and sellers
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Total Conversations</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {conversations?.length || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Unread Messages</p>
                    <p className="text-2xl font-bold text-red-600">
                      {unreadCount}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Active Chats</p>
                    <p className="text-2xl font-bold text-green-600">
                      {conversations?.filter(c => c.last_message).length || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Conversations List */}
        {conversations && conversations.length > 0 ? (
          <div className="space-y-3">
            {conversations.map((conv) => {
              const hasUnread = conv.unread_count > 0
              const isRecent = (() => {
                const date = new Date(conv.updated_at)
                const now = new Date()
                const diffHours = (now.getTime() - date.getTime()) / 3600000
                return diffHours < 24
              })()

              return (
                <Link href={`/messages/${conv.id}`} key={conv.id}>
                  <Card className={`hover:shadow-xl transition-all duration-300 cursor-pointer border-2 ${
                    hasUnread
                      ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-white shadow-md'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } group`}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Enhanced Avatar */}
                        <div className={`relative flex-shrink-0 ${
                          hasUnread ? 'ring-2 ring-blue-400 ring-offset-2' : ''
                        }`}>
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                            {conv.other_user_name.charAt(0).toUpperCase()}
                          </div>
                          {hasUnread && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                              <span className="text-xs font-bold text-white">
                                {conv.unread_count > 9 ? '9+' : conv.unread_count}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={`text-lg font-bold truncate ${
                                  hasUnread ? 'text-gray-900' : 'text-gray-700'
                                }`}>
                                  {conv.other_user_name}
                                </h3>
                                {isRecent && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                    Recent
                                  </span>
                                )}
                              </div>

                              {conv.listing_title && (
                                <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                                  <div className="w-4 h-4 rounded bg-purple-100 flex items-center justify-center">
                                    <ShoppingBag className="w-3 h-3 text-purple-600" />
                                  </div>
                                  <span className="truncate font-medium">{conv.listing_title}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-2 ml-4">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                  {formatTime(conv.updated_at)}
                                </span>
                              </div>
                              <ArrowRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${
                                hasUnread ? 'text-blue-500' : 'text-gray-400'
                              }`} />
                            </div>
                          </div>

                          {conv.last_message && (
                            <div className={`rounded-lg p-3 ${
                              hasUnread
                                ? 'bg-blue-50 border border-blue-100'
                                : 'bg-gray-50 border border-gray-100'
                            }`}>
                              <p className={`text-sm truncate ${
                                hasUnread ? 'text-gray-900 font-medium' : 'text-gray-600'
                              }`}>
                                <span className={`font-semibold ${
                                  hasUnread ? 'text-blue-700' : 'text-gray-700'
                                }`}>
                                  {conv.last_message.sender_name}:
                                </span>{' '}
                                {conv.last_message.content}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        ) : (
          <Card className="shadow-xl border-2 border-dashed border-gray-300 bg-white">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                No messages yet
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Start a conversation by messaging a seller from a listing page. Connect with your neighbors and build your community!
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/marketplace">
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Browse Marketplace
                  </Button>
                </Link>
                <Link href="/feed">
                  <Button variant="outline" className="border-2">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Explore Feed
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
