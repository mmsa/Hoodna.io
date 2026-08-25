"use client"

import { useId, useState } from "react"
import { AlertTriangle, BadgeHelp, ListChecks, Loader2, Megaphone, Search, Send, ShoppingBag, Sparkles } from "lucide-react"
import { Input } from "@/components/ui/input"

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
import { useTranslation } from "@/components/locale-provider"

import { POST_CATEGORIES, type PostCategory } from "./types"

interface PostComposerProps {
  userName: string
  userAvatarUrl?: string | null
  isSubmitting: boolean
  onSubmit: (post: {
    content: string
    category: PostCategory
    is_urgent: boolean
    poll?: { question?: string; options: Array<{ label: string }> }
  }) => void
}

export function PostComposer({
  userName,
  userAvatarUrl,
  isSubmitting,
  onSubmit,
}: PostComposerProps) {
  const textareaId = useId()
  const { t } = useTranslation()
  const [content, setContent] = useState("")
  const [category, setCategory] = useState<PostCategory>("GENERAL")
  const [isUrgent, setIsUrgent] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState(["", ""])

  const submit = () => {
    if (!content.trim() || isSubmitting) return
    const options = pollOptions.map((label) => label.trim()).filter(Boolean)
    if (category === "POLL" && options.length < 2) return
    onSubmit({
      content: content.trim(),
      category,
      is_urgent: isUrgent,
      ...(category === "POLL"
        ? { poll: { question: pollQuestion.trim() || undefined, options: options.map((label) => ({ label })) } }
        : {}),
    })
    setContent("")
    setCategory("GENERAL")
    setIsUrgent(false)
    setPollQuestion("")
    setPollOptions(["", ""])
  }

  const quickActions: Array<{
    label: string
    helper: string
    value: PostCategory
    urgent?: boolean
    icon: React.ReactNode
  }> = [
    {
      label: "Lost & found",
      helper: "Report a missing or found item",
      value: "LOST_FOUND",
      icon: <Search className="h-4 w-4" />,
    },
    {
      label: "Poll",
      helper: "Ask neighbours to vote",
      value: "POLL",
      icon: <ListChecks className="h-4 w-4" />,
    },
    {
      label: t("feed.ask"),
      helper: t("feed.categories.GENERAL"),
      value: "DISCUSSION",
      icon: <BadgeHelp className="h-4 w-4" />,
    },
    {
      label: t("feed.report"),
      helper: t("feed.categories.HELP"),
      value: "HELP",
      urgent: true,
      icon: <Megaphone className="h-4 w-4" />,
    },
    {
      label: t("feed.sell"),
      helper: t("feed.categories.MARKETPLACE"),
      value: "MARKETPLACE",
      icon: <ShoppingBag className="h-4 w-4" />,
    },
    {
      label: t("feed.help"),
      helper: t("feed.categories.HELP"),
      value: "HELP",
      icon: <Sparkles className="h-4 w-4" />,
    },
  ]

  return (
    <section
      id="composer"
      aria-label="Create a post"
      className="eljiran-card border-border/70 p-4 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
            Start a conversation
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
            What should your neighbours know right now?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask, report, recommend, or share a quick local update.
          </p>
        </div>
      </div>
      <div className="flex gap-3 sm:gap-4">
        <Avatar name={userName} src={userAvatarUrl} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {quickActions.map((action) => {
              const selected =
                category === action.value && Boolean(isUrgent) === Boolean(action.urgent)

              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    setCategory(action.value)
                    setIsUrgent(Boolean(action.urgent))
                  }}
                  className={
                    selected
                      ? "rounded-[18px] border border-primary/30 bg-primary/10 p-3 text-left"
                      : "rounded-[18px] border border-border/70 bg-background p-3 text-left transition-colors hover:bg-muted/50"
                  }
                >
                  <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-card text-primary shadow-sm">
                    {action.icon}
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {action.label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {action.helper}
                  </p>
                </button>
              )
            })}
          </div>
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
            placeholder={t("feed.composerPrompt")}
            rows={3}
            className="min-h-[6rem] resize-none rounded-[22px] border-border/70 bg-muted/30 text-[15px] leading-6 shadow-none focus-visible:border-primary/30 focus-visible:ring-primary/15"
          />
          {category === "POLL" ? (
            <div className="mt-3 space-y-2 rounded-[18px] border border-border/70 bg-muted/20 p-3">
              <Input
                value={pollQuestion}
                onChange={(event) => setPollQuestion(event.target.value)}
                placeholder="Poll question (optional)"
              />
              {pollOptions.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(event) =>
                      setPollOptions((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? event.target.value : value
                        )
                      )
                    }
                    placeholder={`Option ${index + 1}`}
                  />
                  {pollOptions.length > 2 ? (
                    <Button type="button" variant="ghost" onClick={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              {pollOptions.length < 4 ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setPollOptions((current) => [...current, ""])}>
                  Add option
                </Button>
              ) : null}
            </div>
          ) : null}
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
              {t("feed.urgent")}
            </label>
            <Button
              type="button"
              onClick={submit}
              disabled={!content.trim() || isSubmitting || (category === "POLL" && pollOptions.filter((value) => value.trim()).length < 2)}
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
              {isSubmitting ? t("feed.publishing") : t("feed.publish")}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tip: press <span className="font-medium text-foreground">Ctrl</span> or{" "}
            <span className="font-medium text-foreground">Cmd</span> +{" "}
            <span className="font-medium text-foreground">Enter</span> to post.
          </p>
        </div>
      </div>
    </section>
  )
}
