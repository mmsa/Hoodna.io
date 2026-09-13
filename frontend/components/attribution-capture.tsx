"use client"

import { useEffect } from "react"

import { captureWebFirstTouch } from "@/lib/attribution-store"

export function AttributionCapture() {
  useEffect(() => {
    captureWebFirstTouch()
  }, [])
  return null
}
