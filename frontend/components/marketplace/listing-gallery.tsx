"use client"

import { useState } from "react"
import { Image as ImageIcon } from "lucide-react"

import { SignedFileImage } from "@/components/signed-file"
import { cn } from "@/lib/utils"

export function ListingGallery({
  images,
  title,
}: {
  images: string[]
  title: string
}) {
  const [selected, setSelected] = useState(0)

  if (!images.length) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground sm:aspect-[16/10]">
        <div className="text-center">
          <ImageIcon aria-hidden="true" className="mx-auto h-10 w-10" />
          <p className="mt-2 text-sm">No photos provided</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-secondary sm:aspect-[16/10]">
        <SignedFileImage
          fileUrl={images[selected]}
          alt={`${title}, photo ${selected + 1} of ${images.length}`}
          className="h-full w-full object-contain"
        />
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              aria-label={`View photo ${index + 1}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
              className={cn(
                "aspect-square min-h-11 overflow-hidden rounded-md border bg-secondary",
                selected === index ? "border-primary ring-1 ring-primary" : "border-border"
              )}
            >
              <SignedFileImage
                fileUrl={image}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
