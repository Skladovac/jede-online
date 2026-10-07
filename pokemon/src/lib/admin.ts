import 'server-only'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

/** Správce, nebo 404 (administrace navenek neexistuje). */
export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user?.isAdmin) notFound()
  return user
}
