"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Flag, Loader2, X } from "lucide-react"
import type { ReportCreate } from "@hoodna/shared"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

export function ReportListing({ listingId }: { listingId: number }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportCreate["reason"]>("spam")
  const [description, setDescription] = useState("")
  const { toast } = useToast()
  const mutation = useMutation({
    mutationFn: async () =>
      api.post("/api/reports", {
        reported_type: "listing",
        reported_id: listingId,
        reason,
        description: description.trim() || null,
      } satisfies ReportCreate),
    onSuccess: () => {
      setOpen(false)
      setDescription("")
      toast({
        title: "Report submitted",
        description: "A moderator will review this listing.",
        variant: "success",
      })
    },
    onError: (error: any) =>
      toast({
        title: "Could not submit report",
        description: error?.response?.data?.detail || "Please try again.",
        variant: "destructive",
      }),
  })

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} className="text-muted-foreground">
        <Flag aria-hidden="true" className="h-4 w-4" />
        Report listing
      </Button>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="report-listing-title">
      <div className="flex items-center justify-between">
        <h2 id="report-listing-title" className="font-semibold">Report this listing</h2>
        <Button size="icon" variant="ghost" aria-label="Close report form" onClick={() => setOpen(false)}>
          <X aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-4 space-y-4">
        <div>
          <Label htmlFor="report-reason">Reason</Label>
          <select
            id="report-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportCreate["reason"])}
            className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-3 text-sm"
          >
            <option value="spam">Spam</option>
            <option value="inappropriate">Inappropriate content</option>
            <option value="scam">Suspected scam</option>
            <option value="harassment">Harassment</option>
            <option value="fake">False information</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <Label htmlFor="report-description">Additional details (optional)</Label>
          <Textarea
            id="report-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-2"
          />
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
          Submit report
        </Button>
      </div>
    </section>
  )
}
