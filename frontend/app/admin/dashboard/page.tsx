'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckCircle, XCircle, AlertCircle, Loader2, ExternalLink, Users, Wrench, Shield } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import Link from 'next/link'

// Import components from existing pages
import ResidentVerifications from './components/resident-verifications'
import ProviderReviews from './components/provider-reviews'
import ModeratorReviews from './components/moderator-reviews'

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('residents')

  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-600">Access denied. Admin only.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Review and manage user verifications and applications</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="residents" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Residents
            </TabsTrigger>
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Service Providers
            </TabsTrigger>
            <TabsTrigger value="moderators" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Moderators
            </TabsTrigger>
          </TabsList>

          <TabsContent value="residents" className="mt-0">
            <ResidentVerifications />
          </TabsContent>

          <TabsContent value="providers" className="mt-0">
            <ProviderReviews />
          </TabsContent>

          <TabsContent value="moderators" className="mt-0">
            <ModeratorReviews />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

