'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/**
 * Animace webu (GSAP). Všude platí: s „omezit pohyb“ v systému nic neanimujeme (obsah rovnou v konečném stavu)
 * a počáteční skrytí dělá GSAP, ne CSS — bez JavaScriptu je vše normálně vidět (Google, AI, starší prohlížeče).
 */
const MOTION_OK = '(prefers-reduced-motion: no-preference)'

/**
 * Úvodní animaci spustit jen tehdy, když se stránka „oživila“ rychle. Při pomalém načtení (slabý mobil) už lidé
 * obsah vidí ze serveru — skrýt ho a nechat přiletět by vypadalo jako bliknutí. Při přechodu mezi stránkami v aplikaci
 * se obsah vykreslí až s animací, tam bliknutí nehrozí.
 */
let firstAt: number | null = null
let firstOk = true
const introAllowed = () => {
  const now = performance.now()
  if (firstAt === null) {
    firstAt = now
    firstOk = now < 1800
  }
  // Stejné oživení stránky (všechny animace naráz) → stejné rozhodnutí; pozdější přechody v aplikaci → animovat.
  return now - firstAt < 1000 ? firstOk : true
}

/** Vějíř karet v hero: karty „vyletí“ z balíčku a rozloží se. Cílí na [data-fan-card] a [data-fan-placard]. */
export function FanIntro({ children, className }: { children: React.ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(
    () => {
      if (!introAllowed()) return
      gsap.matchMedia().add(MOTION_OK, () => {
        const tl = gsap.timeline({ defaults: { ease: 'back.out(1.5)' } })
        tl.from('[data-fan-card]', { y: 90, scale: 0.7, rotation: () => gsap.utils.random(-14, 14), opacity: 0, duration: 0.75, stagger: 0.09 })
        tl.from('[data-fan-placard]', { y: 16, opacity: 0, duration: 0.5, ease: 'power3.out' }, '-=0.25')
      })
    },
    { scope: root },
  )
  return (
    <div ref={root} className={className} aria-hidden>
      {children}
    </div>
  )
}

/** Číslo, které se při načtení „napočítá“ (24 135 → animace od nuly). Bez animace hned konečná hodnota. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const el = useRef<HTMLElement>(null)
  useGSAP(() => {
    if (!introAllowed()) return
    gsap.matchMedia().add(MOTION_OK, () => {
      const o = { v: 0 }
      gsap.to(o, {
        v: value,
        duration: 1.3,
        ease: 'power2.out',
        snap: { v: 1 },
        onUpdate: () => {
          if (el.current) el.current.textContent = o.v.toLocaleString('cs-CZ')
        },
      })
    })
  }, [value])
  return (
    <b ref={el} className={className}>
      {value.toLocaleString('cs-CZ')}
    </b>
  )
}

/**
 * Holografická karta: při pohybu myši se karta naklání ve 3D a přelétne po ní duhový lesk (jako skutečná holo karta).
 * Jen myš/touchpad (na dotykových zařízeních klidná), jen bez „omezit pohyb“.
 */
export function HoloCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const shine = useRef<HTMLDivElement>(null)
  const { contextSafe } = useGSAP({ scope: wrap })
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    setEnabled(window.matchMedia(`${MOTION_OK} and (hover: hover) and (pointer: fine)`).matches)
  }, [])

  const move = contextSafe((e: React.PointerEvent) => {
    if (!enabled || !card.current || !shine.current) return
    const r = card.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width // 0–1
    const py = (e.clientY - r.top) / r.height
    gsap.to(card.current, { rotationY: (px - 0.5) * 18, rotationX: (0.5 - py) * 18, scale: 1.03, duration: 0.4, ease: 'power2.out' })
    gsap.to(shine.current, { opacity: 1, '--hx': `${px * 100}%`, '--hy': `${py * 100}%`, duration: 0.3 })
  })
  const leave = contextSafe(() => {
    if (!enabled || !card.current || !shine.current) return
    gsap.to(card.current, { rotationY: 0, rotationX: 0, scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.6)' })
    gsap.to(shine.current, { opacity: 0, duration: 0.4 })
  })

  return (
    <div ref={wrap} className={`[perspective:1000px] ${className}`} onPointerMove={move} onPointerLeave={leave}>
      <div ref={card} className="relative [transform-style:preserve-3d] [will-change:transform]">
        {children}
        <div
          ref={shine}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[4.5%/3.2%] opacity-0 mix-blend-color-dodge"
          style={{
            background:
              'radial-gradient(circle at var(--hx,50%) var(--hy,50%), rgba(255,255,255,0.55), transparent 42%), linear-gradient(115deg, transparent 20%, rgba(255,120,200,0.28) 36%, rgba(120,220,255,0.28) 50%, rgba(255,240,120,0.28) 64%, transparent 80%)',
          }}
        />
      </div>
    </div>
  )
}

/** „Vyskočení“ potvrzení (např. karta přidaná do alba): při každé změně `trigger` se obsah krátce nafoukne a usadí. */
export function Pop({ trigger, children, className }: { trigger: unknown; children: React.ReactNode; className?: string }) {
  const el = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (!trigger) return
    gsap.matchMedia().add(MOTION_OK, () => {
      gsap.fromTo(el.current, { scale: 0.86, y: 12, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: 'back.out(2)' })
      gsap.fromTo(el.current!.querySelectorAll('[data-pop-thumb]'), { rotation: -12, scale: 1.25 }, { rotation: 0, scale: 1, duration: 0.6, ease: 'back.out(2.2)' })
    })
  }, [trigger])
  return (
    <div ref={el} className={className}>
      {children}
    </div>
  )
}

/** Oslava kompletní sady: výbuch konfet (barvy webu) a hláška uprostřed obrazovky. `show` = počítadlo spuštění. */
export function Celebration({ show, title, text }: { show: number; title: string; text: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!show) return
    setVisible(true)
    const id = setTimeout(() => setVisible(false), 3800)
    return () => clearTimeout(id)
  }, [show])
  useGSAP(
    () => {
      if (!visible) return
      const mm = gsap.matchMedia()
      mm.add(MOTION_OK, () => {
        gsap.from('[data-cel-box]', { scale: 0.6, opacity: 0, duration: 0.6, ease: 'back.out(2)' })
        gsap.utils.toArray<HTMLElement>('[data-confetti]').forEach((p) => {
          gsap.fromTo(
            p,
            { x: 0, y: 0, rotation: 0, opacity: 1 },
            {
              x: gsap.utils.random(-320, 320),
              y: gsap.utils.random(-260, 220),
              rotation: gsap.utils.random(-540, 540),
              opacity: 0,
              duration: gsap.utils.random(1.2, 2.2),
              ease: 'power3.out',
            },
          )
        })
      })
    },
    { scope: root, dependencies: [visible] },
  )
  if (!visible) return null
  const colors = ['#FFCB05', '#2A75BB', '#E3350D', '#1f8a5b', '#ffffff']
  return (
    <div ref={root} className="pointer-events-none fixed inset-0 z-[60] grid place-items-center" role="status" aria-live="polite">
      <div className="relative">
        {Array.from({ length: 46 }, (_, i) => (
          <span
            key={i}
            data-confetti
            className="absolute left-1/2 top-1/2 block h-2.5 w-1.5 rounded-[2px] motion-reduce:hidden"
            style={{ background: colors[i % colors.length] }}
          />
        ))}
        <div data-cel-box className="relative rounded-[22px] bg-[var(--ink)] px-7 py-5 text-center text-white shadow-[0_30px_80px_-20px_rgba(14,27,46,0.7)]">
          <p className="font-display text-2xl font-extrabold text-brand-yellow">{title}</p>
          <p className="mt-1 text-sm text-[#c9d3e3]">{text}</p>
        </div>
      </div>
    </div>
  )
}
