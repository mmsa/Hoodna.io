'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import api from '@/lib/api'
import { Send } from 'lucide-react'

interface Post {
  id: number
  author_name: string
  content: string
  created_at: string
  comments: Comment[]
}

interface Comment {
  id: number
  author_name: string
  content: string
  created_at: string
}

export default function FeedPage() {
  const router = useRouter()
  const [newPost, setNewPost] = useState('')
  const [newComments, setNewComments] = useState<Record<number, string>>({})
  const queryClient = useQueryClient()

  const { data: posts, isLoading, error } = useQuery<Post[]>({
    queryKey: ['feed'],
    queryFn: async () => {
      const response = await api.get('/api/feed')
      return response.data
    },
    retry: false,
  })

  // Redirect based on error type
  useEffect(() => {
    if (error) {
      const errorResponse = (error as any).response
      const errorDetail = errorResponse?.data?.detail || ''
      
      // Redirect to compound selection if compound not selected
      if (errorResponse?.status === 400 && errorDetail.includes('compound')) {
        router.push('/onboarding/compound-select')
      }
      // Redirect to verification if user not verified
      else if (errorResponse?.status === 403 && (errorDetail.includes('verified') || errorDetail.includes('approved'))) {
        router.push('/verification')
      }
    }
  }, [error, router])

  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post('/api/posts', { content })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      setNewPost('')
    },
  })

  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      const response = await api.post(`/api/posts/${postId}/comments`, { content })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] })
    },
  })

  const handleCreatePost = () => {
    if (newPost.trim()) {
      createPostMutation.mutate(newPost)
    }
  }

  const handleCreateComment = (postId: number) => {
    const content = newComments[postId]
    if (content?.trim()) {
      createCommentMutation.mutate({ postId, content })
      setNewComments({ ...newComments, [postId]: '' })
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Community Feed</h1>

        {/* Create Post */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Input
                placeholder="What's on your mind?"
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreatePost()}
              />
              <Button
                onClick={handleCreatePost}
                disabled={createPostMutation.isPending || !newPost.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Posts */}
        {posts?.map((post) => (
          <Card key={post.id}>
            <CardContent className="p-6">
              <div className="mb-4">
                <div className="font-semibold">{post.author_name}</div>
                <div className="text-sm text-gray-500">
                  {new Date(post.created_at).toLocaleString()}
                </div>
              </div>
              <p className="mb-4">{post.content}</p>

              {/* Comments */}
              <div className="border-t pt-4 space-y-3">
                {post.comments?.map((comment) => (
                  <div key={comment.id} className="pl-4 border-l-2">
                    <div className="font-semibold text-sm">{comment.author_name}</div>
                    <p className="text-sm">{comment.content}</p>
                  </div>
                ))}

                {/* Add Comment */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a comment..."
                    value={newComments[post.id] || ''}
                    onChange={(e) =>
                      setNewComments({ ...newComments, [post.id]: e.target.value })
                    }
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateComment(post.id)}
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCreateComment(post.id)}
                    disabled={
                      createCommentMutation.isPending || !newComments[post.id]?.trim()
                    }
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

