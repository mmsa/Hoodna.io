"use client"

import { useState, type ReactNode } from "react"
import {
  ReportCreateSchema,
  type ReportEntityType,
  type ReportReason,
} from "@hoodna/shared"
import { Flag, Loader2 } from "lucide-react"

import api from "@/lib/api"
import { track } from "@/lib/telemetry"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

const REASONS: Array<{ value: ReportReason; label: string }> = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "false_information", label: "False information" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "duplicate_listing", label: "Duplicate" },
  { value: "other", label: "Other" },
]

export function ReportDialog({
  entityType,
  entityId,
  trigger,
}: {
  entityType: ReportEntityType
  entityId: number
  trigger?: ReactNode
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | "">("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const parsed = ReportCreateSchema.safeParse({
      reported_type: entityType,
      reported_id: entityId,
      reason,
      description: description.trim() || undefined,
    })
    if (!parsed.success) {
      setError("Choose a reason and keep details under 2,000 characters.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await api.post(`/api/reports/${entityType}/${entityId}`, parsed.data)
      track("report_submitted", { entity_type: entityType, reason: parsed.data.reason })
      toast({ title: "Report submitted", description: "Thank you. Our moderation team will review it." })
      setOpen(false)
      setReason("")
      setDescription("")
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || "Could not submit this report. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Flag aria-hidden="true" className="h-4 w-4" />
            Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {entityType}</DialogTitle>
          <DialogDescription>
            Reports are confidential. Do not include passwords, payment details, or other sensitive information.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`report-reason-${entityType}-${entityId}`}>Reason</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
              <SelectTrigger id={`report-reason-${entityType}-${entityId}`}>
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`report-details-${entityType}-${entityId}`}>Details (optional)</Label>
            <Textarea
              id={`report-details-${entityType}-${entityId}`}
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add context that will help the moderation team."
            />
            <p className="text-right text-xs text-muted-foreground">{description.length}/2000</p>
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
