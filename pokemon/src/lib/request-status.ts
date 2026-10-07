import type { RequestStatus } from '@prisma/client'

export const STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'v košíku', cls: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  PENDING: { label: 'čeká na odpověď', cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-300' },
  ACCEPTED: { label: 'přijato – domluvte se', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300' },
  DECLINED: { label: 'odmítnuto', cls: 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300' },
  CANCELLED: { label: 'zrušeno', cls: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  COMPLETED: { label: 'dokončeno', cls: 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300' },
}
