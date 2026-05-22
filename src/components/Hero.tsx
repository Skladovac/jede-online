'use client'

import { useEffect, useRef, useState } from 'react'
import { openModal } from '@/lib/openModal'

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [btnHovered, setBtnHovered] = useState(false)

  // Three.js particle network
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let animId: number
    let renderer: import('three').WebGLRenderer
    let isDestroyed = false

    const mouse = { x: 0, y: 0 }

    const init = async () => {
      const THREE = await import('three')
      if (isDestroyed) return

      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(window.innerWidth, window.innerHeight)

      const scene = new THREE.Scene()
      const fov = 60
      const cameraZ = 8
      const camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, 100)
      camera.position.z = cameraZ

      const halfH = Math.tan((fov / 2) * (Math.PI / 180)) * cameraZ
      const halfW = halfH * camera.aspect

      const COUNT = 90
      const pos = new Float32Array(COUNT * 3)
      const vel: number[] = []

      for (let i = 0; i < COUNT; i++) {
        pos[i * 3]     = (Math.random() - 0.5) * halfW * 2
        pos[i * 3 + 1] = (Math.random() - 0.5) * halfH * 2
        pos[i * 3 + 2] = 0
        vel.push(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
        )
      }

      const pointGeo = new THREE.BufferGeometry()
      pointGeo.setAttribute('position', new THREE.BufferAttribute(pos.slice(), 3))

      const pointMat = new THREE.PointsMaterial({
        color: 0xC9A961,
        size: 0.055,
        transparent: true,
        opacity: 0.65,
      })

      const pointCloud = new THREE.Points(pointGeo, pointMat)
      scene.add(pointCloud)

      const MAX_LINES = 800
      const lineBuf = new Float32Array(MAX_LINES * 6)
      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', new THREE.BufferAttribute(lineBuf, 3))
      lineGeo.setDrawRange(0, 0)

      const lineMat = new THREE.LineBasicMaterial({
        color: 0xC9A961,
        transparent: true,
        opacity: 0.1,
      })

      const lines = new THREE.LineSegments(lineGeo, lineMat)
      scene.add(lines)

      const CONNECTION_DIST = halfH * 0.65

      const onMouseMove = (e: MouseEvent) => {
        const ndcX = (e.clientX / window.innerWidth) * 2 - 1
        const ndcY = -((e.clientY / window.innerHeight) * 2 - 1)
        mouse.x = ndcX * halfW
        mouse.y = ndcY * halfH
      }
      window.addEventListener('mousemove', onMouseMove, { passive: true })

      const onResize = () => {
        if (!renderer || isDestroyed) return
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }
      window.addEventListener('resize', onResize, { passive: true })

      const animate = () => {
        animId = requestAnimationFrame(animate)
        const p = pointGeo.attributes.position.array as Float32Array

        for (let i = 0; i < COUNT; i++) {
          const idx = i * 2
          p[i * 3]     += vel[idx]
          p[i * 3 + 1] += vel[idx + 1]

          if (p[i * 3] > halfW || p[i * 3] < -halfW)         vel[idx] *= -1
          if (p[i * 3 + 1] > halfH || p[i * 3 + 1] < -halfH) vel[idx + 1] *= -1

          const dx = mouse.x - p[i * 3]
          const dy = mouse.y - p[i * 3 + 1]
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            vel[idx]     += dx * 0.00004
            vel[idx + 1] += dy * 0.00004
          }

          const speed = Math.sqrt(vel[idx] ** 2 + vel[idx + 1] ** 2)
          if (speed > 0.018) {
            vel[idx]     = (vel[idx] / speed) * 0.018
            vel[idx + 1] = (vel[idx + 1] / speed) * 0.018
          }
        }
        pointGeo.attributes.position.needsUpdate = true

        const lp = lineGeo.attributes.position.array as Float32Array
        let lineCount = 0

        outer: for (let i = 0; i < COUNT; i++) {
          for (let j = i + 1; j < COUNT; j++) {
            if (lineCount >= MAX_LINES) break outer
            const dx = p[i * 3] - p[j * 3]
            const dy = p[i * 3 + 1] - p[j * 3 + 1]
            if (Math.sqrt(dx * dx + dy * dy) < CONNECTION_DIST) {
              lp[lineCount * 6]     = p[i * 3]
              lp[lineCount * 6 + 1] = p[i * 3 + 1]
              lp[lineCount * 6 + 2] = 0
              lp[lineCount * 6 + 3] = p[j * 3]
              lp[lineCount * 6 + 4] = p[j * 3 + 1]
              lp[lineCount * 6 + 5] = 0
              lineCount++
            }
          }
        }

        lineGeo.setDrawRange(0, lineCount * 2)
        lineGeo.attributes.position.needsUpdate = true
        renderer.render(scene, camera)
      }
      animate()

      ;(init as any)._cleanup = () => {
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('resize', onResize)
        cancelAnimationFrame(animId)
        pointGeo.dispose()
        lineGeo.dispose()
        pointMat.dispose()
        lineMat.dispose()
        renderer.dispose()
      }
    }

    init()

    return () => {
      isDestroyed = true
      cancelAnimationFrame(animId)
      ;(init as any)._cleanup?.()
    }
  }, [])

  // Hero text entrance animation
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.hero-animate')
    elements.forEach((el, i) => {
      el.style.opacity = '0'
      el.style.transform = 'translateY(24px)'
      setTimeout(() => {
        el.style.transition = 'opacity 0.9s cubic-bezier(0.4,0,0.2,1), transform 0.9s cubic-bezier(0.4,0,0.2,1)'
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      }, 150 + i * 140)
    })
  }, [])

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      {/* ── Depth layer 1: large bottom-left golden orb ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          bottom: '-200px',
          left: '-200px',
          background: 'radial-gradient(circle, rgba(201,169,97,0.09) 0%, transparent 65%)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Depth layer 2: top-right cooler glow ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          top: '-80px',
          right: '-120px',
          background: 'radial-gradient(circle, rgba(201,169,97,0.055) 0%, transparent 65%)',
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Depth layer 3: center deep ambient ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '1000px',
          height: '700px',
          borderRadius: '50%',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse, rgba(201,169,97,0.035) 0%, transparent 60%)',
          filter: 'blur(120px)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Three.js canvas ── */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      {/* ── Noise texture overlay ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.028,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '160px 160px',
        }}
      />

      {/* ── Vignette: dark edges push focus to center ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: [
            'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 30%, rgba(5,5,8,0.55) 100%)',
            'linear-gradient(to bottom, rgba(5,5,8,0.3) 0%, transparent 15%, transparent 85%, rgba(5,5,8,0.4) 100%)',
          ].join(', '),
          pointerEvents: 'none',
        }}
      />

      {/* ── Content ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          padding: '0 1.5rem',
          maxWidth: '680px',
          width: '100%',
        }}
      >
        {/* Badge */}
        <div
          className="hero-animate"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(201,169,97,0.06)',
            border: '1px solid rgba(201,169,97,0.2)',
            borderRadius: '999px',
            padding: '0.35rem 1rem',
            marginBottom: '2.75rem',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: 'var(--accent-gold)',
              display: 'inline-block',
              boxShadow: '0 0 6px rgba(201,169,97,0.8)',
            }}
          />
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.6875rem',
              color: 'var(--accent-gold)',
              letterSpacing: '0.1em',
            }}
          >
            • Komplexní digitální řešení •
          </span>
        </div>

        {/* H1 */}
        <h1
          className="hero-animate"
          style={{
            fontFamily: '"Clash Display", system-ui, sans-serif',
            fontSize: 'clamp(2.75rem, 7vw, 5rem)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
          }}
        >
          Váš Excel jako aplikace.
          <br />
          Nebo rovnou celý nový web.
        </h1>

        {/* Gold accent line */}
        <div
          className="hero-animate"
          style={{
            width: '2.5rem',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)',
            margin: '2rem auto',
          }}
        />

        {/* Subline */}
        <p
          className="hero-animate"
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.125rem)',
            color: 'var(--text-secondary)',
            lineHeight: 1.75,
            marginBottom: '2.75rem',
            maxWidth: '520px',
            margin: '0 auto 2.75rem',
          }}
        >
          Dáme vašim datům i nápadům digitální tvář. Bez kompromisů,
          bleskově rychle a přesně pro váš byznys.
        </p>

        {/* CTA — otevře modal */}
        <button
          className="hero-animate btn-gold"
          onClick={() => openModal()}
          onMouseEnter={() => setBtnHovered(true)}
          onMouseLeave={() => setBtnHovered(false)}
          style={{
            fontSize: '0.9375rem',
            padding: '0.875rem 2rem',
            transform: btnHovered ? 'translateY(-1px)' : 'translateY(0)',
            boxShadow: btnHovered
              ? '0 0 0 1px rgba(201,169,97,0.3), 0 0 20px rgba(201,169,97,0.45), 0 0 48px rgba(201,169,97,0.2)'
              : '0 0 0 1px rgba(201,169,97,0.15), 0 0 12px rgba(201,169,97,0.2)',
            transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1), box-shadow 0.35s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          Konzultace zdarma →
        </button>

        {/* Scroll indicator */}
        <div
            className="hero-animate"
            style={{
              marginTop: '5.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.5625rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Scrollovat
            </span>
            <div className="scroll-indicator">
              <svg width="14" height="22" viewBox="0 0 14 22" fill="none">
                <rect x="5.5" y="3.5" width="3" height="5" rx="1.5" fill="var(--accent-gold)" opacity="0.7" />
                <rect x="0.5" y="0.5" width="13" height="21" rx="6.5" stroke="rgba(255,255,255,0.1)" />
              </svg>
            </div>
          </div>
      </div>
    </section>
  )
}
