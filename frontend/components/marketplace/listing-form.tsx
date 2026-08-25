"use client"

import { useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { AlertCircle, Image as ImageIcon, Loader2, Upload, X } from "lucide-react"
import {
  ListingCreateSchema,
  type CarAttributes,
  type ItemAttributes,
  type ListingAttributes,
  type ListingCategory,
  type ListingCreate,
  type ListingIntent,
  type PropertyAttributes,
} from "@hoodna/shared"
import * as z from "zod"

import { SignedFileImage } from "@/components/signed-file"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import api from "@/lib/api"
import { uploadToPresignedUrl } from "@/lib/upload"
import { cn } from "@/lib/utils"
import { categoryMeta, friendlyListingValue } from "./listing-meta"

const ITEM_CONDITIONS: ItemAttributes["condition"][] = ["NEW", "LIKE_NEW", "USED", "FAIR"]
const TRANSMISSIONS: CarAttributes["transmission"][] = ["AUTOMATIC", "MANUAL"]
const FUEL_TYPES: CarAttributes["fuel_type"][] = ["PETROL", "DIESEL", "ELECTRIC", "HYBRID"]
const PROPERTY_TYPES: PropertyAttributes["property_type"][] = ["APARTMENT", "VILLA", "TOWNHOUSE", "STUDIO", "DUPLEX"]
const FURNISHING: PropertyAttributes["furnishing"][] = ["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"]

const listingFormSchema = z.object({
  category: z.enum(["PROPERTY", "CAR", "ITEM", "SERVICE"]),
  title: z.string().trim().min(3, "Enter at least 3 characters"),
  description: z.string(),
  price: z.string().refine(
    (value) => !value.trim() || (Number.isFinite(Number(value)) && Number(value) >= 0),
    "Enter a valid non-negative price"
  ),
  intent: z.enum(["SELL", "RENT", "FREE"]),
  condition: z.enum(["NEW", "LIKE_NEW", "USED", "FAIR"]).optional(),
  carMake: z.string(),
  carModel: z.string(),
  carYear: z.string(),
  carMileage: z.string(),
  carTransmission: z.enum(["AUTOMATIC", "MANUAL"]).optional(),
  carFuelType: z.enum(["PETROL", "DIESEL", "ELECTRIC", "HYBRID"]).optional(),
  propertyType: z.enum(["APARTMENT", "VILLA", "TOWNHOUSE", "STUDIO", "DUPLEX"]).optional(),
  bedrooms: z.string(),
  bathrooms: z.string(),
  areaSqm: z.string(),
  furnishing: z.enum(["UNFURNISHED", "SEMI_FURNISHED", "FURNISHED"]).optional(),
}).superRefine((values, ctx) => {
  if ((values.category === "ITEM" || values.category === "CAR") && values.intent === "RENT") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["intent"], message: "Choose for sale or free" })
  }
  if (values.category === "SERVICE" && values.intent === "FREE") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["intent"], message: "Services cannot be free listings" })
  }
  if (values.category === "ITEM" && !values.condition) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["condition"], message: "Choose the item condition" })
  }
  if (values.category === "CAR") {
    if (!values.carMake.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carMake"], message: "Make is required" })
    if (!values.carModel.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carModel"], message: "Model is required" })
    const year = Number(values.carYear)
    if (!values.carYear.trim() || !Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carYear"], message: `Enter a year from 1886 to ${new Date().getFullYear() + 1}` })
    }
    const mileage = Number(values.carMileage)
    if (!values.carMileage.trim() || !Number.isInteger(mileage) || mileage < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carMileage"], message: "Enter a non-negative whole number" })
    }
    if (!values.carTransmission) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carTransmission"], message: "Choose a transmission" })
    if (!values.carFuelType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carFuelType"], message: "Choose a fuel type" })
  }
  if (values.category === "PROPERTY") {
    if (!values.propertyType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["propertyType"], message: "Choose a property type" })
    for (const [path, value, label] of [
      ["bedrooms", values.bedrooms, "Bedrooms"],
      ["bathrooms", values.bathrooms, "Bathrooms"],
    ] as const) {
      const count = Number(value)
      if (!value.trim() || !Number.isInteger(count) || count < 0 || count > 100) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: `${label} must be from 0 to 100` })
      }
    }
    const area = Number(values.areaSqm)
    if (!values.areaSqm.trim() || !Number.isFinite(area) || area <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["areaSqm"], message: "Enter an area greater than zero" })
    }
    if (!values.furnishing) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["furnishing"], message: "Choose furnishing" })
  }
})

type ListingFormFields = z.infer<typeof listingFormSchema>
export type ListingFormValues = ListingCreate

interface ListingFormProps {
  initialValues: Partial<ListingCreate> & { category: ListingCategory }
  intentLocked?: boolean
  submitting?: boolean
  submitLabel: string
  onCancel: () => void
  onChangeCategory?: () => void
  onSubmit: (values: ListingFormValues) => void
}

export function ListingForm({
  initialValues,
  intentLocked = false,
  submitting = false,
  submitLabel,
  onCancel,
  onChangeCategory,
  onSubmit,
}: ListingFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState(initialValues.image_urls ?? [])
  const [uploading, setUploading] = useState<string[]>([])
  const [failedFiles, setFailedFiles] = useState<string[]>([])
  const attributes = initialValues.attributes
  const itemAttributes = attributes && "condition" in attributes ? attributes : null
  const carAttributes = attributes && "make" in attributes ? attributes : null
  const propertyAttributes = attributes && "property_type" in attributes ? attributes : null
  const form = useForm<ListingFormFields>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: {
      category: initialValues.category,
      title: initialValues.title ?? "",
      description: initialValues.description ?? "",
      price: initialValues.price == null ? "" : String(initialValues.price),
      intent: initialValues.intent ?? "SELL",
      condition: itemAttributes?.condition,
      carMake: carAttributes?.make ?? "",
      carModel: carAttributes?.model ?? "",
      carYear: carAttributes ? String(carAttributes.year) : "",
      carMileage: carAttributes ? String(carAttributes.mileage_km) : "",
      carTransmission: carAttributes?.transmission,
      carFuelType: carAttributes?.fuel_type,
      propertyType: propertyAttributes?.property_type,
      bedrooms: propertyAttributes ? String(propertyAttributes.bedrooms) : "",
      bathrooms: propertyAttributes ? String(propertyAttributes.bathrooms) : "",
      areaSqm: propertyAttributes ? String(propertyAttributes.area_sqm) : "",
      furnishing: propertyAttributes?.furnishing,
    },
  })
  const category = form.watch("category")
  const intent = form.watch("intent")
  const categoryDetails = categoryMeta(category)
  const CategoryIcon = categoryDetails.icon

  function buildAttributes(values: ListingFormFields): ListingAttributes | null {
    if (values.category === "SERVICE") return null
    if (values.category === "ITEM") return { condition: values.condition! }
    if (values.category === "CAR") {
      return {
        make: values.carMake.trim(),
        model: values.carModel.trim(),
        year: Number(values.carYear),
        mileage_km: Number(values.carMileage),
        transmission: values.carTransmission!,
        fuel_type: values.carFuelType!,
      }
    }
    return {
      property_type: values.propertyType!,
      bedrooms: Number(values.bedrooms),
      bathrooms: Number(values.bathrooms),
      area_sqm: Number(values.areaSqm),
      furnishing: values.furnishing!,
    }
  }

  function submit(values: ListingFormFields) {
    const result = ListingCreateSchema.safeParse({
      category: values.category,
      title: values.title.trim(),
      description: values.description.trim() || undefined,
      price: values.intent === "FREE" ? null : values.price.trim() ? Number(values.price) : null,
      currency: "EGP",
      intent: values.intent,
      attributes: buildAttributes(values),
      image_urls: images,
    })
    if (result.success) onSubmit(result.data)
  }

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
      onSubmit={form.handleSubmit(submit)}
      className="space-y-6"
    >
      <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Listing details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use a clear title and enough detail for someone to decide quickly.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            <CategoryIcon aria-hidden="true" className="h-4 w-4" />
            {categoryDetails.label}
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {onChangeCategory ? (
            <Button type="button" variant="ghost" size="sm" onClick={onChangeCategory}>
              Change category
            </Button>
          ) : null}

          {category === "PROPERTY" || category === "SERVICE" || category === "ITEM" || category === "CAR" ? (
            <fieldset>
              <legend className="text-sm font-medium">
                {category === "SERVICE" ? "Pricing" : "Listing type"}
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(category === "SERVICE"
                  ? (["SELL", "RENT"] as ListingIntent[])
                  : category === "PROPERTY"
                    ? (["SELL", "RENT", "FREE"] as ListingIntent[])
                    : (["SELL", "FREE"] as ListingIntent[])
                ).map((value) => (
                  <button
                    key={value}
                    type="button"
                    disabled={intentLocked}
                    aria-pressed={intent === value}
                    onClick={() => form.setValue("intent", value, { shouldValidate: true })}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70",
                      intent === value ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-muted"
                    )}
                  >
                    {category === "SERVICE"
                      ? value === "SELL" ? "One-time" : "Hourly"
                      : value === "SELL" ? "For sale" : value === "RENT" ? "For rent" : "Free"}
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}

          {category === "ITEM" ? (
            <fieldset>
              <legend className="text-sm font-medium">Condition</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ITEM_CONDITIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={form.watch("condition") === value}
                    onClick={() => form.setValue("condition", value, { shouldValidate: true })}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 text-sm font-medium",
                      form.watch("condition") === value ? "border-primary bg-accent" : "border-border hover:bg-muted"
                    )}
                  >
                    {friendlyListingValue(value)}
                  </button>
                ))}
              </div>
              <FormError message={form.formState.errors.condition?.message} />
            </fieldset>
          ) : null}

          {category === "CAR" ? (
            <div>
              <h3 className="text-sm font-medium">Vehicle details</h3>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <FormInput id="car-make" label="Make" placeholder="Toyota" registration={form.register("carMake")} error={form.formState.errors.carMake?.message} />
                <FormInput id="car-model" label="Model" placeholder="Corolla" registration={form.register("carModel")} error={form.formState.errors.carModel?.message} />
                <FormInput id="car-year" label="Year" type="number" min="1886" max={String(new Date().getFullYear() + 1)} registration={form.register("carYear")} error={form.formState.errors.carYear?.message} />
                <FormInput id="car-mileage" label="Mileage (km)" type="number" min="0" step="1" registration={form.register("carMileage")} error={form.formState.errors.carMileage?.message} />
                <FormSelect label="Transmission" value={form.watch("carTransmission")} options={TRANSMISSIONS} onChange={(value) => form.setValue("carTransmission", value as CarAttributes["transmission"], { shouldValidate: true })} error={form.formState.errors.carTransmission?.message} />
                <FormSelect label="Fuel type" value={form.watch("carFuelType")} options={FUEL_TYPES} onChange={(value) => form.setValue("carFuelType", value as CarAttributes["fuel_type"], { shouldValidate: true })} error={form.formState.errors.carFuelType?.message} />
              </div>
            </div>
          ) : null}

          {category === "PROPERTY" ? (
            <div>
              <h3 className="text-sm font-medium">Property details</h3>
              <div className="mt-2 grid gap-4 sm:grid-cols-2">
                <FormSelect label="Property type" value={form.watch("propertyType")} options={PROPERTY_TYPES} onChange={(value) => form.setValue("propertyType", value as PropertyAttributes["property_type"], { shouldValidate: true })} error={form.formState.errors.propertyType?.message} />
                <FormSelect label="Furnishing" value={form.watch("furnishing")} options={FURNISHING} onChange={(value) => form.setValue("furnishing", value as PropertyAttributes["furnishing"], { shouldValidate: true })} error={form.formState.errors.furnishing?.message} />
                <FormInput id="property-bedrooms" label="Bedrooms" type="number" min="0" max="100" step="1" registration={form.register("bedrooms")} error={form.formState.errors.bedrooms?.message} />
                <FormInput id="property-bathrooms" label="Bathrooms" type="number" min="0" max="100" step="1" registration={form.register("bathrooms")} error={form.formState.errors.bathrooms?.message} />
                <FormInput id="property-area" label="Area (m²)" type="number" min="0" step="0.01" registration={form.register("areaSqm")} error={form.formState.errors.areaSqm?.message} />
              </div>
            </div>
          ) : null}

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

          {intent !== "FREE" ? <div>
            <Label htmlFor="listing-price">
              {category === "SERVICE" && intent === "RENT" ? "Hourly price (EGP)" : "Price (EGP)"}
            </Label>
            <Input
              id="listing-price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              {...form.register("price")}
              className="mt-2"
              placeholder={category === "SERVICE" ? "Leave blank for a quote" : "Leave blank for price on request"}
              aria-invalid={Boolean(form.formState.errors.price)}
            />
            <FormError message={form.formState.errors.price?.message} />
          </div> : (
            <div className="rounded-lg bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
              Free listings do not have a price.
            </div>
          )}
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

function FormError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-destructive">{message}</p> : null
}

function FormInput({
  id,
  label,
  error,
  registration,
  ...props
}: React.ComponentProps<typeof Input> & {
  id: string
  label: string
  error?: string
  registration: ReturnType<ReturnType<typeof useForm<ListingFormFields>>["register"]>
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...registration} {...props} className="mt-2" aria-invalid={Boolean(error)} />
      <FormError message={error} />
    </div>
  )
}

function FormSelect({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string
  value?: string
  options: readonly string[]
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-2" aria-label={label} aria-invalid={Boolean(error)}>
          <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{friendlyListingValue(option)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormError message={error} />
    </div>
  )
}
