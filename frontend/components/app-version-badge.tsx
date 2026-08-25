import { APP_VERSION } from '@/lib/app-version'

export function AppVersionBadge() {
  return (
    <div
      className="pointer-events-none fixed bottom-2 right-2 z-50 text-[10px] text-muted-foreground/70"
      aria-hidden="true"
    >
      v{APP_VERSION}
    </div>
  )
}
