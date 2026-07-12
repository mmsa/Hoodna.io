"use client"

import { useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { AlertCircle, Image as ImageIcon, Loader2, Upload, X } from "lucide-react"
import * as z from "zod"
import type { ListingCategory, ListingIntent } from "@hoodna/shared"

import { SignedFileImage } from "@/components/signed-file"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api"
import { uploadToPresignedUrl } from "@/lib/upload"
import { cn } from "@/lib/utils"
import { LISTING_CATEGORIES } from "./listing-meta"

const listingFormSchema = z.object({
  category: z.enum(["PROPERTY", "CAR", "ITEM", "SERVICE"]),
  title: z.string().trim().min(3, "Enter at least 3 characters"),
  description: z.string().optional(),
  price: z.string().optional(),
  intent: z.enum(["SELL", "RENT"]),
})

export type ListingFormValues = z.infer<typeof listingFormSchema>

interface ListingFormProps {
  initialValues?: Partial<ListingFormValues> & { image_urls?: string[] }
  serviceOnly?: boolean
  submitting?: boolean
  submitLabel: string
  onCancel: () => void
  onSubmit: (values: ListingFormValues & { image_urls: string[] }) => void
}

export function ListingForm({
  initialValues,
  serviceOnly = false,
  submitting = false,
  submitLabel,
  onCancel,
  onSubmit,
}: ListingFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState(initialValues?.image_urls ?? [])
  const [uploading, setUploading] = useState<string[]>([])
  const [failedFiles, setFailedFiles] = useState<string[]>([])
  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      category: (serviceOnly ? "SERVICE" : initialValues?.category ?? "ITEM") as ListingCategory,
      title: initialValues?.title ?? "",
      description: initialValues?.description ?? "",
      price: initialValues?.price ?? "",
      intent: (initialValues?.intent ?? "SELL") as ListingIntent,
    },
  })
  const category = form.watch("category")
  const intent = form.watch("intent")
  const categories = LISTING_CATEGORIES.filter(
    (item) => item.value && (!serviceOnly || item.value === "SERVICE")
  )

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setFailedFiles((current) => [...current, file.name])
      return
    }
    setUploading((current) => [...current, file.name])
    setFailedFiles((current) => current.filter((name) => name !== file.name))
    try {
      const response = await api.post("/api/listings/images/presign", {
        file_name: file.name,
        file_type: file.type,
      })
      await uploadToPresignedUrl(response.data.presigned_url, file)
      setImages((current) => [...current, response.data.file_url])
    } catch {
      setFailedFiles((current) => [...current, file.name])
    } finally {
      setUploading((current) => current.filter((name) => name !== file.name))
    }
  }

  async function handleFiles(files: FileList | File[]) {
    await Promise.all(Array.from(files).map(uploadFile))
    if (inputRef.current) inputRef.current.value = ""
  }

  const uploadingCount = uploading.length

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit({ ...values, image_urls: images }))}
      className="space-y-6"
    >
      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Listing details</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use a clear title and enough detail for someone to decide quickly.</p>

        <div className="mt-5 space-y-5">
          <fieldset>
            <legend className="text-sm font-medium">Category</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {categories.map((item) => {
                const Icon = item.icon
                const selected = category === item.value
                return (
                  <button
                    key={item.value}
                    type="button"
                    disabled={serviceOnly}
                    aria-pressed={selected}
                    onClick={() => form.setValue("category", item.value as ListingCategory)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm font-medium",
                      selected
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-card hover:bg-muted"
                    )}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="listing-title">Title</Label>
            <Input
              id="listing-title"
              autoComplete="off"
              aria-invalid={Boolean(form.formState.errors.title)}
              aria-describedby={form.formState.errors.title ? "listing-title-error" : undefined}
              {...form.register("title")}
              className="mt-2"
            />
            {form.formState.errors.title ? (
              <p id="listing-title-error" className="mt-1 text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="listing-description">Description</Label>
            <Textarea
              id="listing-description"
              {...form.register("description")}
              className="mt-2 min-h-32 resize-y"
              placeholder="Condition, dimensions, availability, and anything else buyers should know."
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="listing-price">Price (EGP)</Label>
              <Input
                id="listing-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                {...form.register("price")}
                className="mt-2"
                placeholder="Leave blank if negotiable"
              />
            </div>
            <fieldset>
              <legend className="text-sm font-medium">
                {category === "SERVICE" ? "Pricing type" : "Listing type"}
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["SELL", "RENT"] as ListingIntent[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={intent === value}
                    onClick={() => form.setValue("intent", value)}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 text-sm font-medium",
                      intent === value
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    {category === "SERVICE"
                      ? value === "SELL" ? "One-time" : "Hourly"
                      : value === "SELL" ? "For sale" : "For rent"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Photos</h2>
        <p className="mt-1 text-sm text-muted-foreground">The first image is used as the cover. JPG, PNG, and WebP are supported.</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => event.target.files && handleFiles(event.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={(event) => {
            event.preventDefault()
            handleFiles(event.dataTransfer.files)
          }}
          onDragOver={(event) => event.preventDefault()}
          className="mt-4 flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-input bg-secondary/40 p-4 text-sm hover:border-primary"
        >
          <Upload aria-hidden="true" className="mb-2 h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Choose photos or drop them here</span>
          {uploadingCount ? (
            <span role="status" className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
              Uploading {uploadingCount} {uploadingCount === 1 ? "photo" : "photos"}
            </span>
          ) : null}
        </button>

        {failedFiles.length ? (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Some photos could not be uploaded.</p>
              <p className="mt-0.5">{failedFiles.join(", ")}</p>
            </div>
          </div>
        ) : null}

        {images.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((image, index) => (
              <div key={`${image}-${index}`} className="relative aspect-square overflow-hidden rounded-md border border-border">
                <SignedFileImage fileUrl={image} alt={`Uploaded photo ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={`Remove photo ${index + 1}`}
                  className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card/95 text-foreground hover:text-destructive"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
                {index === 0 ? (
                  <span className="absolute bottom-2 left-2 rounded bg-card/95 px-2 py-1 text-xs font-medium">Cover</span>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon aria-hidden="true" className="h-4 w-4" />
            No photos added
          </div>
        )}
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting || uploadingCount > 0}>
          {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
