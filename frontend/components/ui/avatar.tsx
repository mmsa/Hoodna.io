import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

type AvatarSize = "sm" | "md" | "lg"

const avatarSizes: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
}

export interface AvatarProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  name: string
  src?: string | null
  size?: AvatarSize
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ name, src, size = "md", className, ...props }, ref) => (
    <span
      ref={ref}
      role="img"
      aria-label={name}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-secondary font-medium text-secondary-foreground",
        avatarSizes[size],
        className
      )}
      {...props}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={size === "sm" ? "32px" : size === "lg" ? "48px" : "40px"}
          className="object-cover"
        />
      ) : (
        <span aria-hidden="true">{getInitials(name) || "?"}</span>
      )}
    </span>
  )
)
Avatar.displayName = "Avatar"

export { Avatar }
