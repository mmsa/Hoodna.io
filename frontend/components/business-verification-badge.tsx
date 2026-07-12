import type { BusinessVerificationStatus } from "@hoodna/shared"
import { BadgeCheck, Building2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const COPY: Record<BusinessVerificationStatus, { label: string; help: string; className: string }> = {
  VERIFIED: {
    label: "Verified business",
    help: "Eljiran has verified that this profile is managed by the business.",
    className: "border-green-200 bg-green-50 text-green-800",
  },
  CLAIMED: {
    label: "Claimed",
    help: "A business representative manages this profile. Verification is not complete.",
    className: "border-blue-200 bg-blue-50 text-blue-800",
  },
  UNVERIFIED: {
    label: "Unverified",
    help: "Eljiran has not verified who manages this business profile.",
    className: "border-gray-200 bg-gray-50 text-gray-700",
  },
}

export function BusinessVerificationBadge({
  status,
  className,
}: {
  status: BusinessVerificationStatus
  className?: string
}) {
  const content = COPY[status]
  const Icon = status === "VERIFIED" ? BadgeCheck : Building2

  return (
    <Badge
      variant="outline"
      className={cn("inline-flex gap-1", content.className, className)}
      aria-label={`${content.label}. ${content.help}`}
      title={content.help}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {content.label}
    </Badge>
  )
}
