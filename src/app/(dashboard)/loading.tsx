import { CrmPage, CrmSkeleton } from '@/components/crm/CrmShell'

export default function DashboardLoading() {
  return (
    <CrmPage>
      <CrmSkeleton rows={7} />
    </CrmPage>
  )
}
