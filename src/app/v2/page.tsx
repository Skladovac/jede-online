'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export default function V2Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const outlineRef = useRef<HTMLDivElement>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('Pojďme to rozjet')
  const mousePos = useRef({ x: 0, y: 0 })
  const outlinePos = useRef({ x: 0, y: 0 })

  /* ── 1. Body styles (overflow hidden + cursor none) ── */
  useEffect(() => {
    const prev = {
      overflow: document.body.style.overflow,
      cursor: document.body.style.cursor,
    }
    document.body.style.overflow = 'hidden'
    document.body.style.cursor = 'none'
    return () => {
      document.body.style.overflow = prev.overflow
      document.body.style.cursor = prev.cursor
    }
  }, [])

  /* ── 2. Custom cursor ── */
  useEffect(() => {
    const dot = dotRef.current
    const outline = outlineRef.current
    if (!dot || !outline) return

    const half = window.innerWidth / 2
    const halfV = window.innerHeight / 2
    mousePos.current = { x: half, y: halfV }
    outlinePos.current = { x: half, y: halfV }

    const onMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
      dot.style.left = `${e.clientX}px`
      dot.style.top = `${e.clientY}px`
    }
    window.addEventListener('mousemove', onMove)

    let rafId: number
    const tick = () => {
      outlinePos.current.x += (mousePos.current.x - outlinePos.current.x) * 0.15
      outlinePos.current.y += (mousePos.current.y - outlinePos.current.y) * 0.15
      outline.style.left = `${outlinePos.current.x}px`
      outline.style.top = `${outlinePos.current.y}px`
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafId)
    }
  }, [])

  /* ── 3. Canvas plexus animation ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    const particles: {
      x: number; y: number; vx: number; vy: number; size: number
    }[] = []

    const resize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1,
        size: Math.random() * 2,
      })
    }

    let rafId: number
    const animate = () => {
      ctx.clearRect(0, 0, w, h)
      const mx = mousePos.current.x
      const my = mousePos.current.y

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        const dx = mx - p.x
        const dy = my - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 150) {
          p.x -= dx * 0.01
          p.y -= dy * 0.01
        }

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1

        ctx.fillStyle = '#D4AF37'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const ex = p.x - q.x
          const ey = p.y - q.y
          const d = Math.sqrt(ex * ex + ey * ey)
          if (d < 120) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(212,175,55,${1 - d / 120})`
            ctx.lineWidth = 0.5
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }
      }
      rafId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafId)
    }
  }, [])

  /* ── 4. Magnetic buttons ── */
  const handleMagneticMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    ;(e.currentTarget as HTMLElement).style.transform = `translate(${x * 0.3}px,${y * 0.3}px)`
  }, [])

  const handleMagneticLeave = useCallback((e: React.MouseEvent<HTMLElement>) => {
    ;(e.currentTarget as HTMLElement).style.transform = 'translate(0,0)'
    if (outlineRef.current) {
      outlineRef.current.style.transform = 'translate(-50%,-50%) scale(1)'
      outlineRef.current.style.background = 'transparent'
    }
  }, [])

  const handleMagneticEnter = useCallback(() => {
    if (outlineRef.current) {
      outlineRef.current.style.transform = 'translate(-50%,-50%) scale(1.5)'
      outlineRef.current.style.background = 'rgba(212,175,55,0.1)'
    }
  }, [])

  const openForm = (title: string) => {
    setModalTitle(title)
    setIsModalOpen(true)
  }

  return (
    <>
      {/* Urbanist font */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;600;700&display=swap');
        .v2-root { font-family: 'Urbanist', sans-serif; }
        .v2-root * { margin: 0; padding: 0; box-sizing: border-box; }
        .v2-root a, .v2-root button, .v2-root input, .v2-root textarea { cursor: none; }
      `}</style>

      <div className="v2-root" style={{
        position: 'fixed', inset: 0,
        background: '#050505',
        color: '#fff',
        fontFamily: "'Urbanist', sans-serif",
        zIndex: 50, /* sits above grain-overlay */
      }}>

        {/* Custom cursor */}
        <div ref={dotRef} style={{
          width: 8, height: 8,
          background: '#D4AF37',
          borderRadius: '50%',
          position: 'fixed', pointerEvents: 'none',
          zIndex: 9999, transform: 'translate(-50%,-50%)',
        }} />
        <div ref={outlineRef} style={{
          width: 40, height: 40,
          border: '1px solid rgba(212,175,55,0.5)',
          borderRadius: '50%',
          position: 'fixed', pointerEvents: 'none',
          zIndex: 9998, transform: 'translate(-50%,-50%)',
          transition: 'width 0.2s, height 0.2s, background 0.2s',
        }} />

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%', zIndex: 1,
            transition: 'filter 0.8s cubic-bezier(0.25,1,0.5,1)',
            filter: isModalOpen ? 'blur(15px) brightness(0.3)' : 'none',
            transform: isModalOpen ? 'scale(1.02)' : 'scale(1)',
          }}
        />

        {/* Vignette */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
          background: 'radial-gradient(circle at center, transparent 30%, #050505 100%)',
          zIndex: 2, pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{
          position: 'absolute', top: 40, left: 50,
          fontSize: 32, fontWeight: 700,
          zIndex: 10, letterSpacing: -1,
          display: 'flex', alignItems: 'center',
        }}>
          jede
          <span style={{
            width: 12, height: 12,
            background: '#00FF66',
            borderRadius: '50%', margin: '0 4px',
            boxShadow: '0 0 15px #00FF66',
            display: 'inline-block',
            animation: 'v2pulse 2s infinite',
          }} />
          online
        </div>

        {/* CTA Buttons */}
        <div style={{
          position: 'absolute', bottom: 80, width: '100%',
          display: 'flex', justifyContent: 'center', gap: 40,
          zIndex: 10,
        }}>
          <button
            className="magnetic-btn"
            onMouseMove={handleMagneticMove}
            onMouseLeave={handleMagneticLeave}
            onMouseEnter={handleMagneticEnter}
            onClick={() => openForm('Chci vytvořit web')}
            style={{
              padding: '20px 50px',
              fontSize: 15, fontWeight: 600,
              letterSpacing: 2, textTransform: 'uppercase',
              borderRadius: 100,
              background: '#D4AF37', color: '#000',
              boxShadow: '0 10px 30px rgba(212,175,55,0.3)',
              border: '1px solid #D4AF37',
              fontFamily: "'Urbanist', sans-serif",
              transition: 'transform 0.2s cubic-bezier(0.25,1,0.5,1)',
            }}
          >
            Vytvořit nový web
          </button>
          <button
            className="magnetic-btn"
            onMouseMove={handleMagneticMove}
            onMouseLeave={handleMagneticLeave}
            onMouseEnter={handleMagneticEnter}
            onClick={() => openForm('Chci aplikaci z Excelu')}
            style={{
              padding: '20px 50px',
              fontSize: 15, fontWeight: 600,
              letterSpacing: 2, textTransform: 'uppercase',
              borderRadius: 100,
              background: 'rgba(5,5,5,0.4)', color: '#D4AF37',
              border: '1px solid rgba(212,175,55,0.5)',
              backdropFilter: 'blur(5px)',
              fontFamily: "'Urbanist', sans-serif",
              transition: 'transform 0.2s cubic-bezier(0.25,1,0.5,1)',
            }}
          >
            Převést Excel do aplikace
          </button>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false) }}
            style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              zIndex: 100,
              animation: 'v2fadeIn 0.3s ease forwards',
            }}
          >
            <div style={{
              background: 'rgba(15,15,15,0.6)',
              backdropFilter: 'blur(25px)',
              WebkitBackdropFilter: 'blur(25px)',
              border: '1px solid rgba(212,175,55,0.15)',
              padding: 60, borderRadius: 30,
              width: '100%', maxWidth: 550,
              boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
              position: 'relative',
              animation: 'v2slideUp 0.4s cubic-bezier(0.25,1,0.5,1) forwards',
            }}>
              {/* Close */}
              <button
                onClick={() => setIsModalOpen(false)}
                onMouseEnter={handleMagneticEnter}
                onMouseLeave={handleMagneticLeave}
                style={{
                  position: 'absolute', top: 24, right: 28,
                  fontSize: 40, fontWeight: 300, lineHeight: '20px',
                  color: 'rgba(255,255,255,0.5)',
                  background: 'none', border: 'none',
                  transition: 'color 0.3s',
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>

              <h2 style={{ fontSize: 36, marginBottom: 40, fontWeight: 300 }}>
                {modalTitle}
              </h2>

              <form onSubmit={(e) => {
                e.preventDefault()
                alert('Excelentní volba. Ozveme se zpět.')
                setIsModalOpen(false)
              }}>
                <input
                  type="text"
                  placeholder="Tvé jméno"
                  required
                  onMouseEnter={handleMagneticEnter}
                  onMouseLeave={handleMagneticLeave}
                  style={{
                    width: '100%', background: 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)',
                    padding: '15px 0', color: '#fff', fontSize: 18,
                    fontFamily: "'Urbanist', sans-serif",
                    marginBottom: 30, display: 'block',
                  }}
                />
                <input
                  type="email"
                  placeholder="E-mail"
                  required
                  onMouseEnter={handleMagneticEnter}
                  onMouseLeave={handleMagneticLeave}
                  style={{
                    width: '100%', background: 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)',
                    padding: '15px 0', color: '#fff', fontSize: 18,
                    fontFamily: "'Urbanist', sans-serif",
                    marginBottom: 30, display: 'block',
                  }}
                />
                <textarea
                  placeholder="Stručný popis projektu"
                  required
                  onMouseEnter={handleMagneticEnter}
                  onMouseLeave={handleMagneticLeave}
                  style={{
                    width: '100%', background: 'transparent',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)',
                    padding: '15px 0', color: '#fff', fontSize: 18,
                    fontFamily: "'Urbanist', sans-serif",
                    marginBottom: 30, height: 60, resize: 'none', display: 'block',
                  }}
                />
                <button
                  type="submit"
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  onMouseEnter={handleMagneticEnter}
                  style={{
                    width: '100%', marginTop: 20,
                    padding: '20px 50px',
                    fontSize: 15, fontWeight: 600,
                    letterSpacing: 2, textTransform: 'uppercase',
                    borderRadius: 100,
                    background: '#D4AF37', color: '#000',
                    boxShadow: '0 10px 30px rgba(212,175,55,0.3)',
                    border: '1px solid #D4AF37',
                    fontFamily: "'Urbanist', sans-serif",
                    transition: 'transform 0.2s cubic-bezier(0.25,1,0.5,1)',
                  }}
                >
                  Odeslat
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Keyframe animations */}
        <style>{`
          @keyframes v2pulse {
            0%   { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,255,102,0.7); }
            70%  { transform: scale(1);    box-shadow: 0 0 0 10px rgba(0,255,102,0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,255,102,0); }
          }
          @keyframes v2fadeIn  { from { opacity: 0 } to { opacity: 1 } }
          @keyframes v2slideUp { from { transform: translateY(40px) } to { transform: translateY(0) } }
          input:focus, textarea:focus { outline: none; border-bottom-color: #D4AF37 !important; }
          input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.35); }
        `}</style>
      </div>
    </>
  )
}
