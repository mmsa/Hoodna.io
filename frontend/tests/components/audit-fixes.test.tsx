import { ReportCreateSchema, buildReferralInviteUrl } from "@hoodna/shared"
import { describe, expect, it, vi } from "vitest"

import { PostComposer } from "@/app/feed/components/post-composer"
import { ReportDialog } from "@/components/report-dialog"
import { ListingFilters } from "@/components/marketplace/listing-filters"
import {
  listingIntentFilterLabel,
  listingIntentFilterOptions,
  normalizeListingCategory,
} from "@/components/marketplace/listing-meta"
import { formatFoundResults } from "@/lib/search-copy"
import { render, screen, waitFor } from "../utils/test-utils"

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/components/locale-provider", () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: "en" }),
}))

describe("marketplace intent filters", () => {
  const emptyFilters = {
    search: "",
    intent: "",
    sort: "date_desc",
    minPrice: "",
    maxPrice: "",
  }

  it("normalizes vehicle aliases to CAR and omits rent", () => {
    expect(normalizeListingCategory("Vehicles")).toBe("CAR")
    expect(normalizeListingCategory("VEHICLE")).toBe("CAR")
    expect(listingIntentFilterOptions("CAR")).toEqual([])
    expect(listingIntentFilterOptions("ITEM")).toEqual([])
    expect(listingIntentFilterOptions("Vehicles")).toEqual([])
    expect(listingIntentFilterLabel("PROPERTY")).toBe("Property listing type")
    expect(listingIntentFilterOptions("PROPERTY").map((item) => item.value)).toContain("RENT")
    expect(listingIntentFilterOptions("SERVICE")).toEqual([])
  })

  it("does not render a property listing-type control for Vehicles or Items", async () => {
    for (const category of ["CAR", "Vehicles", "ITEM"]) {
      const { unmount } = render(
        <ListingFilters
          value={{ ...emptyFilters, category }}
          onChange={() => undefined}
          onClear={() => undefined}
        />,
      )
      screen.getByRole("button", { name: /more/i }).click()
      await waitFor(() => {
        expect(screen.getByLabelText("Sort listings")).toBeInTheDocument()
      })
      expect(screen.queryByLabelText("Property listing type")).not.toBeInTheDocument()
      expect(screen.queryByLabelText("Listing type")).not.toBeInTheDocument()
      expect(screen.queryByText("Sale or rent")).not.toBeInTheDocument()
      unmount()
    }
  })

  it("renders the property listing-type control only for Property", async () => {
    render(
      <ListingFilters
        value={{ ...emptyFilters, category: "PROPERTY" }}
        onChange={() => undefined}
        onClear={() => undefined}
      />,
    )
    screen.getByRole("button", { name: /more/i }).click()
    expect(await screen.findByLabelText("Property listing type")).toBeInTheDocument()
  })
})

describe("search result copy", () => {
  it("uses a single pluralised noun for zero results", () => {
    expect(formatFoundResults(0, "audit-no-result-7391")).toBe(
      'Found 0 results for "audit-no-result-7391"',
    )
    expect(formatFoundResults(1, "bike")).toBe('Found 1 result for "bike"')
  })
})

describe("canonical referral origin", () => {
  it("defaults invite URLs to https://eljiran.io and rejects vercel.app", () => {
    const url = buildReferralInviteUrl("zhJSlureibCP")
    expect(url.startsWith("https://eljiran.io/auth/signup?")).toBe(true)
    expect(url).not.toContain("vercel.app")
  })
})

describe("homepage marketing claims", () => {
  it("does not present named or invented resident testimonials", async () => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const source = readFileSync(resolve(__dirname, "../../app/page.tsx"), "utf8")
    expect(source).not.toMatch(/Ahmed Mohamed|Sara Ali|Mohamed Hassan/)
    expect(source).not.toMatch(/From real compounds/)
    expect(source).not.toMatch(/testimonialsTitle/)
  })
})

describe("feed composer shortcuts", () => {
  it("shows Marketplace after Sell and keeps that as the combobox value", async () => {
    render(
      <PostComposer userName="Ada" isSubmitting={false} onSubmit={() => undefined} />,
    )
    screen.getByText("feed.ask").closest("button")?.click()
    screen.getByText("feed.sell").closest("button")?.click()
    await waitFor(() => {
      expect(screen.getByLabelText("Post category")).toHaveTextContent("Marketplace")
    })
  })
})

describe("report dialog", () => {
  it("keeps submit disabled until a reason is chosen", async () => {
    render(<ReportDialog entityType="post" entityId={1} />)
    screen.getByRole("button", { name: /report/i }).click()
    expect(await screen.findByRole("button", { name: /submit report/i })).toBeDisabled()
    expect(
      ReportCreateSchema.safeParse({
        reported_type: "post",
        reported_id: 1,
        reason: "",
      }).success,
    ).toBe(false)
  })
})
