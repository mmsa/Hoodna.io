import { SHARE_UTM, withUtmParams } from "@hoodna/shared"

export function shareViaWhatsApp({ title, url }: { title: string; url: string }) {
  const tracked = withUtmParams(url, SHARE_UTM.whatsappListing)
  const text = encodeURIComponent(`${title}\n${tracked}`)
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
}

export function buildWhatsAppShareUrl({ title, url }: { title: string; url: string }) {
  const tracked = withUtmParams(url, SHARE_UTM.whatsappListing)
  const text = encodeURIComponent(`${title}\n${tracked}`)
  return `https://wa.me/?text=${text}`
}
