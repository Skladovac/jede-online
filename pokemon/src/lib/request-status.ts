import type { RequestStatus } from '@prisma/client'

export const STATUS: Record<RequestStatus, { label: string; cls: string }> = {
  DRAFT: { label: 'v košíku', cls: 'bg-surface text-muted ring-1 ring-inset ring-line' },
  PENDING: { label: 'čeká na odpověď', cls: 'bg-[#fff6d6] text-[#7a5600] ring-1 ring-inset ring-[#f5e19a] dark:bg-[rgba(255,203,5,0.12)] dark:text-[#ffd95c] dark:ring-[rgba(255,203,5,0.3)]' },
  ACCEPTED: { label: 'přijato – domluvte se', cls: 'bg-[#e8f0fa] text-[#1d4e89] ring-1 ring-inset ring-[#cadcf2] dark:bg-[rgba(42,117,187,0.18)] dark:text-[#9cc8ff] dark:ring-[rgba(42,117,187,0.38)]' },
  DECLINED: { label: 'odmítnuto', cls: 'bg-[#fdecea] text-[#b42318] ring-1 ring-inset ring-[#f6cfca] dark:bg-[rgba(216,52,26,0.16)] dark:text-[#ff9b8a] dark:ring-[rgba(216,52,26,0.35)]' },
  CANCELLED: { label: 'zrušeno', cls: 'bg-surface text-subtle ring-1 ring-inset ring-line' },
  COMPLETED: { label: 'dokončeno', cls: 'bg-[#e8f5ee] text-[#146c46] ring-1 ring-inset ring-[#c9e9d7] dark:bg-[rgba(31,138,91,0.16)] dark:text-[#7ee0ad] dark:ring-[rgba(31,138,91,0.35)]' },
}
