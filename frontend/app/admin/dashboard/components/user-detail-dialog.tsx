'use client'

import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { formatDocumentType, formatModeratorStatus, formatProviderStatus, formatUserRole, formatUserStatus } from '@/lib/format-enums'
import { SignedFileLink } from '@/components/signed-file'

export interface AdminUserDetail {
  id: number
  name: string
  email: string
  phone?: string
  role?: string
  status: string
  compound_id?: number
  compound_name?: string
  compound_area?: string
  created_at: string
  verification_status?: string
  can_post?: boolean
  can_comment?: boolean
  can_create_listing?: boolean
  verification_documents: Array<{
    id: number
    type: string
    file_url: string
    status: string
    notes?: string
    llm_verified?: boolean
    llm_confidence?: number
    llm_recommendation?: string
    llm_reasoning?: string
    llm_issues?: string[]
    llm_extracted_info?: Record<string, unknown>
    created_at: string
  }>
  compound_memberships: Array<{
    compound_id: number
    compound_name?: string
    compound_area?: string
    created_at: string
  }>
  provider_profile?: Record<string, unknown> | null
  moderator_profile?: Record<string, unknown> | null
  activity: {
    posts: number
    comments: number
    listings: number
    saved_listings: number
    saved_posts: number
    messages_sent: number
    notifications: number
    reviews: number
    reports_filed: number
    conversations: number
  }
}

interface UserDetailDialogProps {
  userId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onResetPassword: (user: { id: number; name: string; email: string }) => void
  onStatusAction: (userId: number, action: 'approve' | 'reject' | 'ban') => void
  statusActionPending?: boolean
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 break-all">{value ?? '—'}</dd>
    </div>
  )
}

function BoolBadge({ value, label }: { value?: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {label}: {value ? 'Yes' : 'No'}
    </span>
  )
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-green-100 text-green-800'
    case 'REJECTED':
      return 'bg-red-100 text-red-800'
    case 'BANNED':
      return 'bg-gray-800 text-white'
    default:
      return 'bg-blue-100 text-blue-800'
  }
}

export default function UserDetailDialog({
  userId,
  open,
  onOpenChange,
  onResetPassword,
  onStatusAction,
  statusActionPending,
}: UserDetailDialogProps) {
  const { data: user, isLoading, error } = useQuery<AdminUserDetail>({
    queryKey: ['admin-user-detail', userId],
    queryFn: async () => {
      const response = await api.get(`/api/admin/users/${userId}`)
      return response.data
    },
    enabled: open && userId != null,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user?.name ?? 'User details'}</DialogTitle>
          <DialogDescription>
            {user ? `${user.email} · ID ${user.id}` : 'Loading user profile…'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Loading user details…</p>
          </div>
        ) : error || !user ? (
          <div className="py-8 text-center text-red-600">Failed to load user details</div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                {formatUserRole(user.role)}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadgeClass(user.status)}`}>
                {formatUserStatus(user.status)}
              </span>
              {user.verification_status && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  Verification: {user.verification_status}
                </span>
              )}
            </div>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Account</h3>
              <dl>
                <DetailRow label="Name" value={user.name} />
                <DetailRow label="Email" value={user.email} />
                <DetailRow label="Phone" value={user.phone} />
                <DetailRow label="User ID" value={user.id} />
                <DetailRow label="Joined" value={new Date(user.created_at).toLocaleString()} />
                <DetailRow
                  label="Primary compound"
                  value={
                    user.compound_name
                      ? `${user.compound_name}${user.compound_area ? ` (${user.compound_area})` : ''} · ID ${user.compound_id}`
                      : user.compound_id
                        ? `ID ${user.compound_id}`
                        : '—'
                  }
                />
              </dl>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Permissions</h3>
              <div className="flex flex-wrap gap-2">
                <BoolBadge value={user.can_post} label="Can post" />
                <BoolBadge value={user.can_comment} label="Can comment" />
                <BoolBadge value={user.can_create_listing} label="Can create listing" />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Activity</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  ['Posts', user.activity.posts],
                  ['Comments', user.activity.comments],
                  ['Listings', user.activity.listings],
                  ['Saved listings', user.activity.saved_listings],
                  ['Saved posts', user.activity.saved_posts],
                  ['Messages', user.activity.messages_sent],
                  ['Conversations', user.activity.conversations],
                  ['Notifications', user.activity.notifications],
                  ['Reviews', user.activity.reviews],
                  ['Reports filed', user.activity.reports_filed],
                ].map(([label, count]) => (
                  <div key={label as string} className="rounded-lg border bg-gray-50 p-3 text-center">
                    <p className="text-lg font-semibold">{count as number}</p>
                    <p className="text-xs text-gray-600">{label as string}</p>
                  </div>
                ))}
              </div>
            </section>

            {user.compound_memberships.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Compound memberships</h3>
                <ul className="space-y-2">
                  {user.compound_memberships.map((m) => (
                    <li key={m.compound_id} className="text-sm border rounded-lg p-3 bg-white">
                      <span className="font-medium">{m.compound_name ?? `Compound ${m.compound_id}`}</span>
                      {m.compound_area && <span className="text-gray-500"> · {m.compound_area}</span>}
                      <span className="block text-xs text-gray-400 mt-1">
                        Since {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {user.verification_documents.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Verification documents</h3>
                <div className="space-y-3">
                  {user.verification_documents.map((doc) => (
                    <div key={doc.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{formatDocumentType(doc.type)}</span>
                        <span className="text-xs px-2 py-1 rounded bg-gray-100">{doc.status}</span>
                      </div>
                      <SignedFileLink fileUrl={doc.file_url} className="text-sm text-blue-600 hover:underline">
                        View document
                      </SignedFileLink>
                      {doc.notes && <p className="text-sm text-gray-600">Notes: {doc.notes}</p>}
                      {doc.llm_recommendation && (
                        <p className="text-sm text-gray-600">
                          AI: {doc.llm_recommendation}
                          {doc.llm_confidence != null && ` (${Math.round(doc.llm_confidence * 100)}%)`}
                        </p>
                      )}
                      {doc.llm_reasoning && (
                        <p className="text-xs text-gray-500 whitespace-pre-wrap">{doc.llm_reasoning}</p>
                      )}
                      {doc.llm_issues && doc.llm_issues.length > 0 && (
                        <ul className="text-xs text-red-600 list-disc pl-4">
                          {doc.llm_issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      )}
                      {doc.llm_extracted_info && Object.keys(doc.llm_extracted_info).length > 0 && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-gray-500">Extracted info</summary>
                          <pre className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto">
                            {JSON.stringify(doc.llm_extracted_info, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {user.provider_profile && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Service provider profile</h3>
                <dl className="border rounded-lg p-4 bg-white">
                  <DetailRow label="Business" value={String(user.provider_profile.business_name ?? '—')} />
                  <DetailRow
                    label="Status"
                    value={formatProviderStatus(String(user.provider_profile.provider_status ?? ''))}
                  />
                  <DetailRow label="Type" value={String(user.provider_profile.provider_type ?? '—')} />
                  <DetailRow label="Phone" value={String(user.provider_profile.phone ?? '—')} />
                  {Boolean(user.provider_profile.rejection_reason) && (
                    <DetailRow label="Rejection" value={String(user.provider_profile.rejection_reason)} />
                  )}
                  {Boolean(user.provider_profile.suspension_reason) && (
                    <DetailRow label="Suspension" value={String(user.provider_profile.suspension_reason)} />
                  )}
                </dl>
                {Array.isArray(user.provider_profile.documents) && user.provider_profile.documents.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {(user.provider_profile.documents as Array<{ document_type: string; file_url: string }>).map(
                      (doc, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span>{formatDocumentType(doc.document_type)}</span>
                          <SignedFileLink fileUrl={doc.file_url} className="text-blue-600 hover:underline">
                            View
                          </SignedFileLink>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            )}

            {user.moderator_profile && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Moderator profile</h3>
                <dl className="border rounded-lg p-4 bg-white">
                  <DetailRow label="Compound" value={String(user.moderator_profile.compound_name ?? '—')} />
                  <DetailRow label="Role title" value={String(user.moderator_profile.role_title ?? '—')} />
                  <DetailRow
                    label="Status"
                    value={formatModeratorStatus(String(user.moderator_profile.moderator_status ?? ''))}
                  />
                  {Boolean(user.moderator_profile.rejection_reason) && (
                    <DetailRow label="Rejection" value={String(user.moderator_profile.rejection_reason)} />
                  )}
                </dl>
                {Array.isArray(user.moderator_profile.documents) && user.moderator_profile.documents.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {(user.moderator_profile.documents as Array<{ document_type: string; file_url: string }>).map(
                      (doc, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span>{formatDocumentType(doc.document_type)}</span>
                          <SignedFileLink fileUrl={doc.file_url} className="text-blue-600 hover:underline">
                            View
                          </SignedFileLink>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResetPassword({ id: user.id, name: user.name, email: user.email })}
              >
                Reset password
              </Button>
              {user.status !== 'APPROVED' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={statusActionPending}
                  onClick={() => onStatusAction(user.id, 'approve')}
                >
                  Approve
                </Button>
              )}
              {user.status !== 'REJECTED' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={statusActionPending}
                  onClick={() => onStatusAction(user.id, 'reject')}
                >
                  Reject
                </Button>
              )}
              {user.status !== 'BANNED' && user.role !== 'ADMIN' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={statusActionPending}
                  onClick={() => onStatusAction(user.id, 'ban')}
                >
                  Ban
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
