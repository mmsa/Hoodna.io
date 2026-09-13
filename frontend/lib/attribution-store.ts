"use client"

import {
  ATTRIBUTION_STORAGE_KEY,
  compactAttribution,
  hasAttribution,
  mergeFirstTouch,
  parseAttributionFromSearch,
  parseReferralCode,
  type StoredFirstTouch,
} from "@hoodna/shared"

function readStored(): StoredFirstTouch | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredFirstTouch
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

function writeStored(value: StoredFirstTouch) {
  window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(value))
}

export function captureWebFirstTouch() {
  if (typeof window === "undefined") return
  const incoming: StoredFirstTouch = {
    attribution: compactAttribution(
      parseAttributionFromSearch(window.location.search, {
        referrer: document.referrer || undefined,
        landingPath: window.location.pathname,
      }),
    ),
    referralCode: parseReferralCode(new URLSearchParams(window.location.search)),
  }
  if (!hasAttribution(incoming.attribution) && !incoming.referralCode) return
  const next = mergeFirstTouch(readStored(), incoming)
  writeStored(next)
}

export function getWebFirstTouch(): StoredFirstTouch | null {
  captureWebFirstTouch()
  return readStored()
}
