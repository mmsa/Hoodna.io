'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import api from '@/lib/api'
import Link from 'next/link'
import {
  ArrowLeft,
  Send,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function NewMessagePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const [messageContent, setMessageContent] = useState('')

  const recipientId = searchParams.get('recipient_id')
  const listingId = searchParams.get('listing_id')

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post('/api/messages', {
        content,
        recipient_id: parseInt(recipientId!),
        listing_id: listingId ? parseInt(listingId) : null,
      })
      return response.data
    },
    onSuccess: async (data) => {
      // Find the conversation ID from the response or fetch conversations
      const conversationsResponse = await api.get('/api/conversations')
      const conversations = conversationsResponse.data
      
      // Find the conversation with this recipient
      const conversation = conversations.find(
        (c: any) => c.other_user_id === parseInt(recipientId!)
      )
      
      if (conversation) {
        router.push(`/messages/${conversation.id}`)
      } else {
        router.push('/messages')
      }
      
      toast({
        title: 'Message sent!',
        description: 'Your message has been sent successfully.',
        variant: 'success',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to send message',
        description: error?.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      })
    },
  })

  const handleSend = () => {
    if (messageContent.trim() && recipientId) {
      sendMessageMutation.mutate(messageContent.trim())
    }
  }

  if (!recipientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <Card className="p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Invalid Request</h1>
          <p className="text-gray-600 mb-6">
            Please select a recipient to send a message.
          </p>
          <Link href="/marketplace">
            <Button>← Back to Marketplace</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href={listingId ? `/listing/${listingId}` : '/marketplace'}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              New Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={6}
                className="mt-2"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Link href={listingId ? `/listing/${listingId}` : '/marketplace'}>
                <Button variant="outline">Cancel</Button>
              </Link>
              <Button
                onClick={handleSend}
                disabled={sendMessageMutation.isPending || !messageContent.trim()}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {sendMessageMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

