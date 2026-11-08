'use client'

import { useEffect } from 'react'
import gsap from 'gsap'

/** Jediný nástup na úvodu: řádky nadpisu vyjedou zespodu, text a tlačítka se krátce zvednou, fotka se rozsvítí. */
export function HeroIntro() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.to('.hero-line > span', { y: 0, duration: 0.9, stagger: 0.08 })
      .to('[data-hero]', { opacity: 1, y: 0, duration: 0.5, stagger: 0.05 }, '-=0.5')
      .to('[data-hero-photo]', { opacity: 1, duration: 0.8 }, 0)
    // Pojistka: když prohlížeč nekreslí snímky (okno v pozadí), dojet na konec, ať obsah nezůstane skrytý.
    const safety = window.setTimeout(() => tl.progress(1), 3000)
    return () => {
      window.clearTimeout(safety)
      tl.kill()
    }
  }, [])
  return null
}
