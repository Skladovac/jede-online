'use client'

import { useEffect } from 'react'
import gsap from 'gsap'

/** Úvodní nástup hlavičky: řádky nadpisu vyjedou zespodu, pak text, tlačítka a fotka. */
export function HeroIntro() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
    tl.to('.hero-line > span', { y: 0, duration: 1.3, stagger: 0.12 })
      .to('[data-hero]', { opacity: 1, y: 0, duration: 1.1, stagger: 0.08 }, '-=0.9')
      .to('[data-hero-photo]', { opacity: 1, scale: 1, duration: 1.8 }, 0)
    // Pojistka: když prohlížeč nekreslí snímky (okno v pozadí), dojet na konec, ať obsah nezůstane skrytý.
    const safety = window.setTimeout(() => tl.progress(1), 3000)
    return () => {
      window.clearTimeout(safety)
      tl.kill()
    }
  }, [])
  return null
}
