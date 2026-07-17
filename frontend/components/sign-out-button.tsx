'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'

import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const HELPER_COPY =
  'Entered the wrong details? Sign out to start again or use another account.'

interface SignOutButtonProps {
  className?: string
  showHelper?: boolean
}

export function SignOutButton({
  className,
  showHelper = true,
}: SignOutButtonProps) {
  const router = useRouter()
  const { logout } = useAuth()
  const signingOutRef = useRef(false)
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (signingOutRef.current) return

    signingOutRef.current = true
    setSigningOut(true)
    try {
      await logout()
    } finally {
      router.replace('/auth/login')
    }
  }

  return (
    <div className={cn('space-y-2 text-center', className)}>
      {showHelper && (
        <>
          <p className="text-sm font-medium text-foreground">{HELPER_COPY}</p>
          <p className="text-xs text-muted-foreground">
            Signing out only clears this session. It does not delete your account.
          </p>
        </>
      )}
      <Button
        aria-label="Sign out and start again"
        className="w-full"
        disabled={signingOut}
        onClick={handleSignOut}
        type="button"
        variant="outline"
      >
        {signingOut ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut aria-hidden="true" className="h-4 w-4" />
        )}
        {signingOut ? 'Signing out...' : 'Sign out and start again'}
      </Button>
    </div>
  )
}
