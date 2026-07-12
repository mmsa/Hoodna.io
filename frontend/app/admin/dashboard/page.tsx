'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Wrench, Shield, Contact, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

import ResidentVerifications from './components/resident-verifications'
import ProviderReviews from './components/provider-reviews'
import ModeratorReviews from './components/moderator-reviews'
import UserManagement from './components/user-management'
import EljiranOperations from './components/eljiran-operations'

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('users')

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
          <p className="text-gray-600">Review verifications, manage users, and operate the Eljiran rollout</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start mb-6">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Contact className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="residents" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Verifications
            </TabsTrigger>
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Service Providers
            </TabsTrigger>
            <TabsTrigger value="moderators" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Moderators
            </TabsTrigger>
            <TabsTrigger value="operations" className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Operations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-0">
            <UserManagement />
          </TabsContent>

          <TabsContent value="residents" className="mt-0">
            <ResidentVerifications />
          </TabsContent>

          <TabsContent value="providers" className="mt-0">
            <ProviderReviews />
          </TabsContent>

          <TabsContent value="moderators" className="mt-0">
            <ModeratorReviews />
          </TabsContent>

          <TabsContent value="operations" className="mt-0">
            <EljiranOperations />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

