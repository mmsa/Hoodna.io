'use client'

import { use, useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  ShoppingBag,
  User,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface Message {
  id: number
  sender_id: number
  sender_name: string
  content: string
  is_read: boolean
  created_at: string
}

interface Conversation {
  id: number
  other_user_id: number
  other_user_name: string
  listing_id?: number
  listing_title?: string
  messages: Message[]
}

export default function ConversationPage({ params }: { params: { id: string } }) {
  const conversationId = parseInt(params.id)
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [messageContent, setMessageContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: conversation, isLoading } = useQuery<Conversation>({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      const response = await api.get(`/api/conversations/${conversationId}`)
      return response.data
    },
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  })

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post(`/api/conversations/${conversationId}/messages`, {
        content,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      setMessageContent('')
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send message',
        description: error?.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  const handleSendMessage = () => {
    if (messageContent.trim()) {
      sendMessageMutation.mutate(messageContent.trim())
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading conversation...</p>
        </div>
      </div>
    )
  }

  if (!conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Card className="p-8 text-center shadow-lg">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Conversation not found</h1>
          <p className="text-gray-600 mb-6">
            The conversation you are looking for does not exist.
          </p>
          <Link href="/messages">
            <Button>← Back to Messages</Button>
          </Link>
        </Card>
      </div>
    )
  }

  const isOwnMessage = (message: Message) => message.sender_id === user?.id

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-screen">
        {/* Header */}
        <div className="bg-white border-b shadow-sm p-4">
          <div className="flex items-center gap-4">
            <Link href="/messages">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold">
              {conversation.other_user_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">
                {conversation.other_user_name}
              </h2>
              {conversation.listing_title && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <ShoppingBag className="w-4 h-4" />
                  <span>{conversation.listing_title}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversation.messages.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            conversation.messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${isOwnMessage(message) ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    isOwnMessage(message)
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  {!isOwnMessage(message) && (
                    <p className="text-xs font-semibold mb-1 opacity-75">
                      {message.sender_name}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-2 ${
                      isOwnMessage(message) ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {new Date(message.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="bg-white border-t p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Type a message..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={sendMessageMutation.isPending || !messageContent.trim()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

