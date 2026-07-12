'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { RoleGuard } from '@/components/role-guard'
import { FeatureConfigProvider } from '@/components/feature-config-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <FeatureConfigProvider>
        <RoleGuard>{children}</RoleGuard>
      </FeatureConfigProvider>
    </QueryClientProvider>
  )
}
