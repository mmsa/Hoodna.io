export function shareViaWhatsApp({ title, url }: { title: string; url: string }) {
  const text = encodeURIComponent(`${title}\n${url}`)
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer")
}

export function buildWhatsAppShareUrl({ title, url }: { title: string; url: string }) {
  const text = encodeURIComponent(`${title}\n${url}`)
  return `https://wa.me/?text=${text}`
}
