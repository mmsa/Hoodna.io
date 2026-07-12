"use client"

import { cn } from "@/lib/utils"

interface ChipProps {
  label: string
  selected?: boolean
  onClick?: () => void
  className?: string
}

export function Chip({ label, selected = false, onClick, className }: ChipProps) {
  const Component = onClick ? "button" : "span"

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "eljiran-pill shrink-0 border transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
        className
      )}
    >
      {label}
    </Component>
  )
}
