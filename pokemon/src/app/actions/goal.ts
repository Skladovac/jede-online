'use server'

import { revalidatePath } from 'next/cache'
import type { SetGoal } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { GOALS, type Goal } from '@/lib/goal'

/** Stránka sady: „Sbírám: Base / Complete / Master“ — uloží cíl pro uživatele a sadu. */
export async function chooseGoal(setId: string, goal: Goal): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Nepřihlášen')
  if (!GOALS.includes(goal)) throw new Error('Neplatný cíl')
  const g = goal.toUpperCase() as SetGoal
  await prisma.setGoalChoice.upsert({
    where: { userId_setId: { userId: user.id, setId } },
    create: { userId: user.id, setId, goal: g },
    update: { goal: g },
  })
  revalidatePath(`/sady/${setId}`)
  revalidatePath('/')
  revalidatePath('/sbirka')
}
