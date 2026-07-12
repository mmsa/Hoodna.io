"use client"

import { useId, useState } from "react"
import { AlertTriangle, Loader2, Send } from "lucide-react"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
    <section
      aria-labelledby={`${textareaId}-heading`}
      className="border-b border-border bg-card px-4 py-4 sm:rounded-lg sm:border"
    >
      <div className="flex gap-3">
        <Avatar name={userName} />
        <div className="min-w-0 flex-1">
          <Label
            id={`${textareaId}-heading`}
            htmlFor={textareaId}
            className="text-sm font-semibold"
          >
            Create a post
          </Label>
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
            placeholder="Share an update or ask your neighbours…"
            rows={3}
            className="mt-2 min-h-24 resize-y bg-card text-[15px] leading-6"
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-44">
              <Label htmlFor={`${textareaId}-category`} className="sr-only">
                Post category
              </Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as PostCategory)}
              >
                <SelectTrigger id={`${textareaId}-category`} className="h-11">
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
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted">
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
          <p className="mt-2 text-xs text-muted-foreground">
            Press Ctrl or ⌘ + Enter to post.
          </p>
        </div>
      </div>
    </section>
  )
}
