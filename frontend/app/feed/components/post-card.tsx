"use client"

import { useEffect, useState } from "react"
import {
  Ban,
  Bell,
  CheckCircle,
  Clock,
  Home,
  MessageCircle,
  Send,
  Share2,
  Trash2,
} from "lucide-react"

import { ReportDialog } from "@/components/report-dialog"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useFeatureConfig } from "@/components/feature-config-provider"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"
import { formatCompoundName } from "@/lib/format-compound"
import { cn } from "@/lib/utils"

import {
  categoryAccentClass,
  categoryBadgeClass,
  categoryLabel,
  formatTimeAgo,
  type Post,
  type ResidentUser,
} from "./types"

interface PostCardProps {
  post: Post
  newComments: Record<number, string>
  setNewComments: (comments: Record<number, string>) => void
  handleCreateComment: (postId: number) => void
  createCommentMutation: { isPending: boolean }
  currentUser?: ResidentUser | null
}

export function PostCard({
  post,
  newComments,
  setNewComments,
  handleCreateComment,
  createCommentMutation,
  currentUser,
}: PostCardProps) {
  const { toast } = useToast()
  const { isEnabled } = useFeatureConfig()
  const communityPostingEnabled = isEnabled("community_posting")
  const [isMounted, setIsMounted] = useState(false)
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(
    post.reaction_counts ?? {}
  )
  const [userReaction, setUserReaction] = useState<string | null>(
    post.user_reaction ?? null
  )

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const timeAgo = formatTimeAgo(post.created_at)
  const isNew =
    isMounted &&
    Date.now() - new Date(post.created_at).getTime() < 3600000

  const handleShare = async () => {
    const url = `${window.location.origin}/feed#post-${post.id}`
    const shareData = {
      title: `${post.author_name} on eljiran.com`,
      text: post.content,
      url,
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
        return
      }

      await navigator.clipboard.writeText(url)
      toast({
        title: "Link copied",
        description: "Post link copied to your clipboard.",
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return

      try {
        await navigator.clipboard.writeText(url)
        toast({
          title: "Link copied",
          description: "Post link copied to your clipboard.",
        })
      } catch {
        toast({
          title: "Could not share post",
          description: "Please copy the page URL manually.",
          variant: "destructive",
        })
      }
    }
  }

  const handleReaction = async (reaction: string) => {
    try {
      const response = await api.put(`/api/posts/${post.id}/reaction`, {
        reaction,
      })
      setReactionCounts(response.data.reaction_counts)
      setUserReaction(response.data.user_reaction)
    } catch (error: unknown) {
      const detail =
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response &&
        error.response.data &&
        typeof error.response.data === "object" &&
        "detail" in error.response.data
          ? String(error.response.data.detail)
          : "Please try again."
      toast({
        title: "Could not react",
        description: detail,
        variant: "destructive",
      })
    }
  }

  const canModerate =
    currentUser &&
    (currentUser.role === "COMPOUND_MOD" ||
      currentUser.role === "MODERATOR" ||
      currentUser.role === "ADMIN") &&
    (currentUser.role === "ADMIN" ||
      ((currentUser.role === "MODERATOR" ||
        currentUser.role === "COMPOUND_MOD") &&
        post.compound_id === currentUser.compound_id))

  return (
    <Card
      id={`post-${post.id}`}
      tabIndex={-1}
      className={cn(
        "social-card scroll-mt-24 border-l-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        categoryAccentClass(post.category)
      )}
    >
      <CardContent className="p-5">
        <div className="mb-3 flex items-start gap-3">
          <div className="relative">
            <Avatar name={post.author_name} size="lg" />
            {isMounted && isNew && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {isMounted && post.compound_name && (
              <div className="mb-1.5 flex items-center gap-1.5">
                <Home className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {formatCompoundName(post.compound_name)}
                </span>
              </div>
            )}
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-foreground">
                  {post.author_name}
                </span>
                {isMounted && post.author_status === "APPROVED" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </span>
                )}
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-medium",
                    categoryBadgeClass(post.category)
                  )}
                >
                  {categoryLabel(post.category)}
                </span>
                {isMounted && post.is_urgent && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    <Bell className="h-3 w-3" />
                    Urgent
                  </span>
                )}
              </div>
              {canModerate && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        confirm(
                          `Are you sure you want to ban ${post.author_name}?`
                        )
                      ) {
                        try {
                          await api.post(
                            `/api/moderator/users/${post.author_id}/ban`,
                            { reason: "Moderator action" }
                          )
                          toast({
                            title: "Success",
                            description: "User has been banned",
                          })
                          window.location.reload()
                        } catch (error: unknown) {
                          const detail =
                            error &&
                            typeof error === "object" &&
                            "response" in error
                              ? (error as { response?: { data?: { detail?: string } } })
                                  .response?.data?.detail || "Failed to ban user"
                              : "Failed to ban user"
                          toast({
                            title: "Error",
                            description: detail,
                            variant: "destructive",
                          })
                        }
                      }
                    }}
                    className="rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                    title="Ban User"
                  >
                    <Ban className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (
                        confirm("Are you sure you want to delete this post?")
                      ) {
                        try {
                          await api.delete(`/api/moderator/posts/${post.id}`)
                          toast({
                            title: "Success",
                            description: "Post deleted successfully",
                          })
                          window.location.reload()
                        } catch (error: unknown) {
                          const detail =
                            error &&
                            typeof error === "object" &&
                            "response" in error
                              ? (error as { response?: { data?: { detail?: string } } })
                                  .response?.data?.detail ||
                                "Failed to delete post"
                              : "Failed to delete post"
                          toast({
                            title: "Error",
                            description: detail,
                            variant: "destructive",
                          })
                        }
                      }
                    }}
                    className="rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                    title="Delete Post"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </div>
          </div>
        </div>

        <p className="mb-4 text-[15px] leading-relaxed text-foreground">
          {post.content}
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-1">
            {(
              [
                ["LOVE", "❤️"],
                ["LIKE", "👍"],
                ["WOW", "😮"],
                ["PRAY", "🙏"],
              ] as const
            ).map(([reaction, emoji]) => {
              const count = reactionCounts[reaction] ?? 0
              const selected = userReaction === reaction
              return (
                <button
                  key={reaction}
                  type="button"
                  onClick={() => handleReaction(reaction)}
                  aria-label={`React with ${reaction.toLowerCase()}`}
                  aria-pressed={selected}
                  className={cn(
                    "flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-1.5 transition-colors",
                    selected
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="text-base">{emoji}</span>
                  {count > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            className="ml-1 flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{post.comments?.length || 0}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Share post"
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          <ReportDialog
            entityType="post"
            entityId={post.id}
            trigger={
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                Report
              </button>
            }
          />
          <ReportDialog
            entityType="user"
            entityId={post.author_id}
            trigger={
              <button
                type="button"
                className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                Report user
              </button>
            }
          />
        </div>

        <div className="space-y-3">
          {post.comments && post.comments.length > 0 && (
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {post.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-md border-l-2 border-border bg-muted/40 p-2.5 pl-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Avatar name={comment.author_name} size="sm" />
                    <span className="text-sm font-medium text-foreground">
                      {comment.author_name}
                    </span>
                    {comment.author_status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Verified
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(comment.created_at)}
                    </span>
                  </div>
                  <p className="ml-10 text-sm leading-relaxed text-foreground">
                    {comment.content}
                  </p>
                  <div className="ml-10 mt-1">
                    <ReportDialog
                      entityType="comment"
                      entityId={comment.id}
                      trigger={
                        <button
                          type="button"
                          className="px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          Report comment
                        </button>
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {communityPostingEnabled ? (
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Write a comment..."
                value={newComments[post.id] || ""}
                onChange={(event) =>
                  setNewComments({
                    ...newComments,
                    [post.id]: event.target.value,
                  })
                }
                onKeyDown={(event) =>
                  event.key === "Enter" && handleCreateComment(post.id)
                }
                className="flex-1 bg-background text-sm"
              />
              <Button
                size="sm"
                onClick={() => handleCreateComment(post.id)}
                disabled={
                  createCommentMutation.isPending ||
                  !newComments[post.id]?.trim()
                }
              >
                {createCommentMutation.isPending ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
