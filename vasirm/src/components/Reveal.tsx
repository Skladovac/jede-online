'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Nástup prvků s [data-reveal] při rolování. Skupina [data-reveal-group] odhaluje děti postupně.
 * Pohyb jen transform/opacity; při „omezit pohyb“ se nic neanimuje (CSS je rovnou nechá vidět).
 */
export function Reveal() {
  const pathname = usePathname()

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timers: number[] = []
    const ctx = gsap.context(() => {
      const els = gsap.utils.toArray<HTMLElement>('[data-reveal]')
      ScrollTrigger.batch(els, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) => {
          const tween = gsap.to(batch, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.09, overwrite: true })
          // Pojistka pro okno v pozadí (prohlížeč nekreslí snímky): obsah nesmí zůstat skrytý.
          timers.push(window.setTimeout(() => tween.progress(1), 2500))
        },
      })
      // Co je při načtení už vidět, odhalit hned (ScrollTrigger to jinak udělá až po prvním rolování).
      ScrollTrigger.refresh()
    })
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      ctx.revert()
    }
  }, [pathname])

  return null
}
