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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Messages
            </h1>
            <p className="text-gray-600">
              Connect with your neighbors and sellers
            </p>
          </div>
        </div>

        {/* Conversations List */}
        {conversations && conversations.length > 0 ? (
          <div className="space-y-4">
            {conversations.map((conv) => (
              <Link href={`/messages/${conv.id}`} key={conv.id}>
                <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {conv.other_user_name.charAt(0).toUpperCase()}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {conv.other_user_name}
                          </h3>
                          {conv.unread_count > 0 && (
                            <span className="px-2 py-1 bg-blue-600 text-white text-xs font-bold rounded-full">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>

                        {conv.listing_title && (
                          <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                            <ShoppingBag className="w-4 h-4" />
                            <span className="truncate">{conv.listing_title}</span>
                          </div>
                        )}

                        {conv.last_message && (
                          <p className="text-gray-600 truncate mb-1">
                            <span className="font-medium">{conv.last_message.sender_name}:</span>{' '}
                            {conv.last_message.content}
                          </p>
                        )}

                        <p className="text-xs text-gray-500">
                          {new Date(conv.updated_at).toLocaleDateString()} at{' '}
                          {new Date(conv.updated_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="shadow-lg border-2 border-dashed border-gray-300 bg-white">
            <CardContent className="p-12 text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                No messages yet
              </h3>
              <p className="text-gray-500 mb-4">
                Start a conversation by messaging a seller from a listing page.
              </p>
              <Link href="/marketplace">
                <Button className="bg-gradient-to-r from-blue-500 to-purple-600">
                  Browse Marketplace
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

