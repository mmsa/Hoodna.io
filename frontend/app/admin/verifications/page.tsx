'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminVerificationsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the unified admin dashboard which has all three sections
    router.replace('/admin/dashboard')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 mb-4">Redirecting to Admin Dashboard...</p>
      </div>
    </div>
  )
}
