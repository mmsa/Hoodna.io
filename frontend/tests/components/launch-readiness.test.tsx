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
    expect(buildReferralInviteUrl("invite + one", "https://example.com")).toContain(
      "ref=invite",
    )
    expect(buildReferralInviteUrl("invite + one", "https://example.com")).toContain("utm_source=referral")
    expect(buildReferralSharePayload("abc123", "https://example.com").url).toContain(
      "auth/signup?ref=abc123",
    )
  })
})

describe("legacy /signup invite redirect", () => {
  it("forwards /signup to /auth/signup so old ref and UTM links keep working", async () => {
    const nextConfig = require("../../next.config.js")
    const redirects = await nextConfig.redirects()
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/signup",
          destination: "/auth/signup",
        }),
      ]),
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

describe("canonical production invite origin", () => {
  it("does not default referral links to vercel.app", () => {
    expect(buildReferralInviteUrl("abc123")).toMatch(/^https:\/\/eljiran\.io\/auth\/signup/)
    expect(buildReferralInviteUrl("abc123")).not.toContain("vercel.app")
  })
})
