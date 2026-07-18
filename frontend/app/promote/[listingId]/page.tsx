"use client"

import Link from "next/link"
import { useMutation } from "@tanstack/react-query"
import { ArrowLeft, Check, Loader2, Megaphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AppShell, PageHeader, PageLayout } from "@/components/ui/page-layout"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

const OPTIONS = [
  {
    scope: "CROSS_COMPOUND" as const,
    title: "Across Eljiran communities",
    description: "Show your listing to signed-in residents beyond your compound.",
    price: "50 EGP",
  },
  {
    scope: "PUBLIC" as const,
    title: "Public reach",
    description: "Make your listing discoverable to everyone, including visitors.",
    price: "100 EGP",
  },
]

export default function PromotePage({
  params,
}: {
  params: { listingId: string }
}) {
  const listingId = Number(params.listingId)
  const { toast } = useToast()
  const mutation = useMutation({
    mutationFn: async (scope: "CROSS_COMPOUND" | "PUBLIC") =>
      (
        await api.post("/api/promotions/checkout", {
          listing_id: listingId,
          scope,
          duration_days: 7,
        })
      ).data,
    onSuccess: (data) => {
      window.location.href = data.url
    },
    onError: (error: any) =>
      toast({
        title: "Checkout could not be started",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      }),
  })

  return (
    <AppShell>
      <PageLayout width="sm" className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href={`/listing/${listingId}`}>
            <ArrowLeft className="h-4 w-4" />Back to listing
          </Link>
        </Button>
        <PageHeader
          eyebrow="Marketplace"
          title="Promote your listing"
          description="Choose where your listing appears. Each promotion runs for seven days."
        />
        <div className="space-y-3">
          {OPTIONS.map((option) => (
            <section key={option.scope} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{option.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.description}</p>
                  <p className="mt-3 flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />Seven days of placement</p>
                  <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
                    <p><span className="text-lg font-semibold">{option.price}</span><span className="text-sm text-muted-foreground"> / week</span></p>
                    <Button onClick={() => mutation.mutate(option.scope)} disabled={mutation.isPending}>
                      {mutation.isPending && mutation.variables === option.scope ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Continue
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">You will review the final amount before paying through secure checkout.</p>
      </PageLayout>
    </AppShell>
  )
}
