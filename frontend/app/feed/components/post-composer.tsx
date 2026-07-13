"use client"

import { useId, useState } from "react"
import { AlertTriangle, Loader2, Send } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { POST_CATEGORIES, type PostCategory } from "./types"

interface PostComposerProps {
  userName: string
  isSubmitting: boolean
  onSubmit: (post: {
    content: string
    category: PostCategory
    is_urgent: boolean
  }) => void
}

export function PostComposer({
  userName,
  isSubmitting,
  onSubmit,
}: PostComposerProps) {
  const textareaId = useId()
  const [content, setContent] = useState("")
  const [category, setCategory] = useState<PostCategory>("GENERAL")
  const [isUrgent, setIsUrgent] = useState(false)

  const submit = () => {
    if (!content.trim() || isSubmitting) return
    onSubmit({ content: content.trim(), category, is_urgent: isUrgent })
    setContent("")
    setCategory("GENERAL")
    setIsUrgent(false)
  }

  return (
    <section aria-label="Create a post" className="eljiran-card p-4 sm:p-5">
      <div className="flex gap-3 sm:gap-4">
        <Avatar name={userName} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <Textarea
            id={textareaId}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="What's happening in the neighbourhood?"
            rows={3}
            className="min-h-[5.5rem] resize-none rounded-2xl border-border/70 bg-muted/30 text-[15px] leading-6 shadow-none focus-visible:border-primary/30 focus-visible:ring-primary/15"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as PostCategory)}
            >
              <SelectTrigger
                id={`${textareaId}-category`}
                aria-label="Post category"
                className="h-10 w-full rounded-full border-border/70 bg-card sm:w-40"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_CATEGORIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/80">
              <input
                type="checkbox"
                checked={isUrgent}
                onChange={(event) => setIsUrgent(event.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
              />
              <AlertTriangle aria-hidden="true" className="h-4 w-4" />
              Mark urgent
            </label>
            <Button
              type="button"
              onClick={submit}
              disabled={!content.trim() || isSubmitting}
              className="sm:ml-auto"
            >
              {isSubmitting ? (
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Send aria-hidden="true" className="h-4 w-4" />
              )}
              Post
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
