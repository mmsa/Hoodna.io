import { Building2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCompoundWithArea } from "@/lib/format-compound"

interface CompoundChipProps {
  name: string
  area?: string | null
  className?: string
}

export function CompoundChip({ name, area, className }: CompoundChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary",
        className
      )}
    >
      <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
      {formatCompoundWithArea(name, area)}
    </span>
  )
}
