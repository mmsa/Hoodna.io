import { render, screen } from "@testing-library/react"
import {
  ReportCreateSchema,
  buildReferralInviteUrl,
  buildReferralSharePayload,
} from "@hoodna/shared"
import { describe, expect, it } from "vitest"

import { BusinessVerificationBadge } from "@/components/business-verification-badge"

describe("BusinessVerificationBadge", () => {
  it("provides a visible and accessible verification label", () => {
    render(<BusinessVerificationBadge status="VERIFIED" />)
    expect(screen.getByText("Verified business")).toBeInTheDocument()
    expect(screen.getByLabelText(/Eljiran has verified/i)).toBeInTheDocument()
  })
})

describe("referral links", () => {
  it("preserves and escapes the referral parameter", () => {
    expect(buildReferralInviteUrl("invite + one", "https://example.com")).toBe(
      "https://example.com/signup?ref=invite%20%2B%20one",
    )
    expect(buildReferralSharePayload("abc123", "https://example.com").url).toContain(
      "signup?ref=abc123",
    )
  })
})

describe("report validation", () => {
  it("rejects missing reasons and invalid entity ids", () => {
    expect(ReportCreateSchema.safeParse({
      reported_type: "business",
      reported_id: 0,
      reason: "",
    }).success).toBe(false)
  })
})
