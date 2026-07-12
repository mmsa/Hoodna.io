import { CheckCircle } from "lucide-react"

import { cn } from "@/lib/utils"

interface VerifiedNeighbourBadgeProps {
  className?: string
  compact?: boolean
}

export function VerifiedNeighbourBadge({
  className,
  compact = false,
}: VerifiedNeighbourBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary",
        compact && "px-2 py-0.5",
        className
      )}
    >
      <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{compact ? "Verified" : "Verified Neighbour"}</span>
    </span>
  )
}
