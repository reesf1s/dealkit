import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="grid min-w-0 max-w-full gap-5">
      <Skeleton className="h-36 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <Skeleton className="h-[620px] rounded-lg" />
        <Skeleton className="h-[620px] rounded-lg" />
        <Skeleton className="h-[620px] rounded-lg xl:col-span-2 2xl:col-span-1" />
      </div>
    </div>
  )
}
