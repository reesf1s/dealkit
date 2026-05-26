import 'server-only'

import { getDealContextNative } from '@/lib/crm/core'

export async function buildDealContext(dealId: string, workspaceId: string) {
  return getDealContextNative(dealId, workspaceId)
}

export type NativeDealContext = Awaited<ReturnType<typeof buildDealContext>>
