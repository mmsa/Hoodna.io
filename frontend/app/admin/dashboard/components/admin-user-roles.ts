export const ADMIN_ASSIGNABLE_ROLES = [
  { value: 'RESIDENT', label: 'Resident' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
  { value: 'COMPOUND_MOD', label: 'Compound Moderator' },
  { value: 'MODERATOR', label: 'Moderator' },
  { value: 'ADMIN', label: 'Admin' },
] as const

export type AdminAssignableRole = (typeof ADMIN_ASSIGNABLE_ROLES)[number]['value']

export function canonicalAdminRole(role?: string | null): AdminAssignableRole {
  if (role === 'USER' || role === 'RESIDENT') return 'RESIDENT'
  if (role === 'SERVICE_PROVIDER') return 'SERVICE_PROVIDER'
  if (role === 'COMPOUND_MOD') return 'COMPOUND_MOD'
  if (role === 'MODERATOR') return 'MODERATOR'
  if (role === 'ADMIN') return 'ADMIN'
  return 'RESIDENT'
}
