"use client"

import { useState } from "react"
import {
  AccountDeletionRequestCreateSchema,
  UserPreferencesSchema,
  buildReferralSharePayload,
  type ReferralMe,
  type ReferralStats,
  type UserPreferences,
} from "@hoodna/shared"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Loader2, Send, Trash2 } from "lucide-react"

import api from "@/lib/api"
import { track } from "@/lib/telemetry"
import { useFeatureConfig } from "@/components/feature-config-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export function LaunchAccountSettings() {
  const { isEnabled } = useFeatureConfig()
  return (
    <>
      {isEnabled("invitations") ? <InviteNeighbours /> : null}
      <NotificationPreferences digestEnabled={isEnabled("weekly_digest")} />
      <DeletionRequest />
    </>
  )
}

function InviteNeighbours() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const referral = useQuery<ReferralMe>({
    queryKey: ["referral-me"],
    queryFn: async () => (await api.get("/api/referrals/me")).data,
    retry: false,
  })
  const stats = useQuery<ReferralStats>({
    queryKey: ["referral-stats"],
    queryFn: async () => (await api.get("/api/referrals/stats")).data,
    retry: false,
  })
  const generate = useMutation({
    mutationFn: async () => (await api.post("/api/referrals/invites", { source: "settings" })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["referral-me"] }),
  })

  const share = async () => {
    if (!referral.data) return
    const payload = buildReferralSharePayload(referral.data.code, window.location.origin)
    try {
      if (navigator.share) {
        await navigator.share({ title: payload.title, text: payload.message, url: payload.url })
        track("invite_shared", { channel: "native_share", source_screen: "settings" })
      } else {
        await navigator.clipboard.writeText(payload.url)
        track("invite_shared", { channel: "clipboard", source_screen: "settings" })
        toast({ title: "Invite link copied" })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      toast({ title: "Could not share", description: "Please copy the invite link.", variant: "destructive" })
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Invite neighbours</CardTitle><CardDescription>Grow your trusted local community with a personal invite link.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-purple-50 p-4"><p className="text-2xl font-bold">{stats.data?.invitations_sent ?? "—"}</p><p className="text-sm text-gray-600">Invites sent</p></div>
          <div className="rounded-lg bg-green-50 p-4"><p className="text-2xl font-bold">{stats.data?.successful_registrations ?? "—"}</p><p className="text-sm text-gray-600">Joined</p></div>
        </div>
        {referral.isLoading ? <p role="status" className="text-sm text-gray-600">Loading invite link…</p> : referral.data ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Referral link" readOnly value={referral.data.invite_url} />
            <Button variant="outline" onClick={async () => {
              await navigator.clipboard.writeText(referral.data!.invite_url)
              track("invite_shared", { channel: "clipboard", source_screen: "settings" })
              toast({ title: "Invite link copied" })
            }}><Copy className="h-4 w-4" />Copy</Button>
            <Button onClick={share}><Send className="h-4 w-4" />Share</Button>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-gray-600">{referral.isError ? "Your invite link is not ready yet." : "Generate your personal invite link."}</p>
            <Button onClick={() => generate.mutate()} disabled={generate.isPending}>{generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Generate invite link</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type NotificationPreferenceKey =
  | "push_notifications"
  | "weekly_digest"
  | "community_announcements"
  | "business_recommendations"

function NotificationPreferences({ digestEnabled }: { digestEnabled: boolean }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const preferences = useQuery<UserPreferences>({
    queryKey: ["user-preferences"],
    queryFn: async () => UserPreferencesSchema.parse((await api.get("/api/auth/me/preferences")).data),
  })
  const update = useMutation({
    mutationFn: async (next: Partial<UserPreferences>) => (await api.patch("/api/auth/me/preferences", next)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(["user-preferences"], data)
      toast({ title: "Preferences saved" })
    },
  })
  const options: Array<[NotificationPreferenceKey, string, string, boolean]> = [
    ["push_notifications", "Push notifications", "Receive timely activity updates.", true],
    ["weekly_digest", "Weekly digest", "Get a weekly summary of neighbourhood activity.", digestEnabled],
    ["community_announcements", "Community announcements", "Hear about important local updates.", true],
    ["business_recommendations", "Business recommendations", "Discover relevant local businesses.", true],
  ]
  return (
    <Card>
      <CardHeader><CardTitle>Notifications</CardTitle><CardDescription>Choose which updates you receive.</CardDescription></CardHeader>
      <CardContent>
        {preferences.isLoading ? <p role="status">Loading preferences…</p> : preferences.isError ? <p role="alert" className="text-red-600">Could not load notification preferences.</p> : (
          <div className="divide-y">
            {options.filter(([, , , visible]) => visible).map(([key, title, description]) => (
              <label className="flex cursor-pointer items-center justify-between gap-4 py-4" key={key}>
                <span><span className="block font-medium">{title}</span><span className="text-sm text-gray-500">{description}</span></span>
                <input
                  type="checkbox"
                  checked={Boolean(preferences.data?.[key])}
                  disabled={update.isPending}
                  onChange={(event) => update.mutate({ [key]: event.target.checked })}
                  className="h-5 w-5"
                />
              </label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DeletionRequest() {
  const [confirmation, setConfirmation] = useState("")
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const request = useMutation({
    mutationFn: async () => {
      const parsed = AccountDeletionRequestCreateSchema.safeParse({ confirmation, reason: reason.trim() || undefined })
      if (!parsed.success) throw new Error('Type "DELETE" exactly to confirm.')
      return api.post("/api/auth/me/deletion-request", parsed.data)
    },
    onSuccess: () => setSubmitted(true),
    onError: (requestError: any) => setError(requestError?.response?.data?.detail || requestError.message),
  })
  return (
    <Card className="border-red-200">
      <CardHeader><CardTitle className="text-red-700">Delete account</CardTitle><CardDescription>This submits a deletion request. Your account may remain available while the request is processed.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {submitted ? <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">Deletion request submitted.</p> : (
          <>
            <div className="space-y-2"><Label htmlFor="deletion-reason">Reason (optional)</Label><Textarea id="deletion-reason" maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="deletion-confirmation">Type DELETE to confirm</Label><Input id="deletion-confirmation" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
            <Button variant="destructive" disabled={confirmation !== "DELETE" || request.isPending} onClick={() => request.mutate()}><Trash2 className="h-4 w-4" />Request account deletion</Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
