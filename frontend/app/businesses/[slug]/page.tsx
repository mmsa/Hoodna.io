"use client"

import { useEffect, useState } from "react"
import {
  BusinessClaimCreateSchema,
  type BusinessDetail,
} from "@hoodna/shared"
import { useQuery } from "@tanstack/react-query"
import { Building2, Globe, Loader2, Mail, MapPin, Phone } from "lucide-react"

import api from "@/lib/api"
import { track } from "@/lib/telemetry"
import { useAuth } from "@/hooks/use-auth"
import { useFeatureConfig } from "@/components/feature-config-provider"
import { BusinessVerificationBadge } from "@/components/business-verification-badge"
import { ReportDialog } from "@/components/report-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function BusinessPage({ params }: { params: { slug: string } }) {
  const business = useQuery<BusinessDetail>({
    queryKey: ["business", params.slug],
    queryFn: async () => (await api.get(`/api/businesses/${encodeURIComponent(params.slug)}`)).data,
  })

  useEffect(() => {
    if (business.data) {
      track("business_profile_viewed", {
        business_id: business.data.id,
        category: business.data.category,
      })
    }
  }, [business.data])

  if (business.isLoading) {
    return <div className="flex min-h-screen items-center justify-center" role="status"><Loader2 className="h-8 w-8 animate-spin" /><span className="sr-only">Loading business</span></div>
  }
  if (business.isError || !business.data) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Business unavailable</h1>
        <p className="mt-2 text-gray-600">This profile could not be loaded.</p>
        <Button className="mt-4" variant="outline" onClick={() => business.refetch()}>Try again</Button>
      </main>
    )
  }

  const item = business.data
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Card>
          {item.image_url ? <img src={item.image_url} alt="" className="h-64 w-full rounded-t-lg object-cover" /> : null}
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">{item.name}</h1>
                <p className="mt-1 text-gray-600">{item.category}</p>
                <BusinessVerificationBadge status={item.verification_status} className="mt-3" />
              </div>
              <div className="flex gap-2">
                <ClaimBusiness business={item} />
                <ReportDialog entityType="business" entityId={item.id} />
              </div>
            </div>
            {item.description ? <p className="mt-6 whitespace-pre-line text-gray-700">{item.description}</p> : null}
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              {item.address ? <Contact icon={<MapPin />} label="Address" value={item.address} /> : null}
              {item.phone ? <Contact icon={<Phone />} label="Phone" value={item.phone} href={`tel:${item.phone}`} /> : null}
              {item.email ? <Contact icon={<Mail />} label="Email" value={item.email} href={`mailto:${item.email}`} /> : null}
              {item.website ? <Contact icon={<Globe />} label="Website" value={item.website} href={item.website} /> : null}
            </dl>
          </CardContent>
        </Card>
        {item.hours ? (
          <Card>
            <CardHeader><CardTitle>Opening hours</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-2">
                {Object.entries(item.hours).map(([day, hours]) => (
                  <div className="flex justify-between gap-4 text-sm" key={day}>
                    <dt className="capitalize text-gray-600">{day}</dt>
                    <dd>{hours.closed ? "Closed" : `${hours.open || "—"} – ${hours.close || "—"}`}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  )
}

function Contact({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>
      <div><dt className="text-gray-500">{label}</dt><dd>{href ? <a href={href} className="text-purple-700 underline">{value}</a> : value}</dd></div>
    </div>
  )
}

function ClaimBusiness({ business }: { business: BusinessDetail }) {
  const { user } = useAuth()
  const { isEnabled } = useFeatureConfig()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    full_name: user?.name || "",
    relationship_role: "",
    phone: user?.phone || "",
    email: user?.email || "",
    supporting_information: "",
    requested_role: "OWNER" as const,
  })

  if (!isEnabled("business_claiming") || business.user_membership_role) return null
  if (business.current_user_claim_status) {
    return <span className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">Claim {business.current_user_claim_status.toLowerCase()}</span>
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = BusinessClaimCreateSchema.safeParse(form)
    if (!parsed.success) {
      setError("Complete all required fields with valid contact details.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await api.post(`/api/businesses/${business.id}/claims`, parsed.data)
      track("business_claim_submitted", { business_id: business.id })
      setSuccess(true)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || "Could not submit your claim.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Building2 className="h-4 w-4" />Claim this business</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Claim {business.name}</DialogTitle>
          <DialogDescription>Tell us how you are connected to this business. The Eljiran team will review your request.</DialogDescription>
        </DialogHeader>
        {success ? (
          <div role="status" className="rounded-lg bg-green-50 p-4 text-green-800">Claim submitted. We will notify you after review.</div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            {[
              ["full_name", "Full name", "text"],
              ["relationship_role", "Role at the business", "text"],
              ["phone", "Phone", "tel"],
              ["email", "Email", "email"],
            ].map(([key, label, type]) => (
              <div className="space-y-2" key={key}>
                <Label htmlFor={`claim-${key}`}>{label}</Label>
                <Input id={`claim-${key}`} type={type} value={form[key as keyof typeof form]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="claim-details">Supporting information (optional)</Label>
              <Textarea id="claim-details" maxLength={4000} value={form.supporting_information} onChange={(event) => setForm({ ...form, supporting_information: event.target.value })} />
            </div>
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Submit claim</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
