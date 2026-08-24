"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface NeighbourProfileLinkProps {
  userId?: number | null
  name: string
  avatarUrl?: string | null
  size?: "sm" | "md" | "lg"
  showAvatar?: boolean
  showName?: boolean
  className?: string
  nameClassName?: string
  children?: ReactNode
}

export function NeighbourProfileLink({
  userId,
  name,
  avatarUrl,
  size = "md",
  showAvatar = true,
  showName = true,
  className,
  nameClassName,
  children,
}: NeighbourProfileLinkProps) {
  const content = children ?? (
    <>
      {showAvatar ? <Avatar name={name} src={avatarUrl} size={size} /> : null}
      {showName ? (
        <span className={cn("font-semibold text-foreground hover:underline", nameClassName)}>
          {name}
        </span>
      ) : null}
    </>
  )

  if (!userId) {
    return <span className={cn("inline-flex items-center gap-2", className)}>{content}</span>
  }

  return (
    <Link
      href={`/neighbours/${userId}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      onClick={(event) => event.stopPropagation()}
      aria-label={`View ${name}'s profile`}
    >
      {content}
    </Link>
  )
}
