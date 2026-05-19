'use client'

import { useEffect, useRef, useState } from 'react'

export function Hero() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

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

      // Compute world bounds at z=0
      const halfH = Math.tan((fov / 2) * (Math.PI / 180)) * cameraZ
      const halfW = halfH * camera.aspect

      // Particles
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
        size: 0.06,
        transparent: true,
        opacity: 0.75,
      })

      const pointCloud = new THREE.Points(pointGeo, pointMat)
      scene.add(pointCloud)

      // Pre-allocated line buffer
      const MAX_LINES = 800
      const lineBuf = new Float32Array(MAX_LINES * 6)
      const lineGeo = new THREE.BufferGeometry()
      lineGeo.setAttribute('position', new THREE.BufferAttribute(lineBuf, 3))
      lineGeo.setDrawRange(0, 0)

      const lineMat = new THREE.LineBasicMaterial({
        color: 0xC9A961,
        transparent: true,
        opacity: 0.13,
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
          // Move
          p[i * 3]     += vel[idx]
          p[i * 3 + 1] += vel[idx + 1]

          // Bounce
          if (p[i * 3] > halfW || p[i * 3] < -halfW)       vel[idx] *= -1
          if (p[i * 3 + 1] > halfH || p[i * 3 + 1] < -halfH) vel[idx + 1] *= -1

          // Mouse attract
          const dx = mouse.x - p[i * 3]
          const dy = mouse.y - p[i * 3 + 1]
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < CONNECTION_DIST) {
            vel[idx]     += dx * 0.00004
            vel[idx + 1] += dy * 0.00004
          }

          // Speed cap
          const speed = Math.sqrt(vel[idx] ** 2 + vel[idx + 1] ** 2)
          if (speed > 0.018) {
            vel[idx]     = (vel[idx] / speed) * 0.018
            vel[idx + 1] = (vel[idx + 1] / speed) * 0.018
          }
        }
        pointGeo.attributes.position.needsUpdate = true

        // Connections
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

      // Cleanup stored in outer scope
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
        el.style.transition = 'opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1)'
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      }, 200 + i * 130)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Zadejte platnou e-mailovou adresu.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'hero' }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Něco se pokazilo. Zkuste to znovu.')
      }
    } catch {
      setError('Nepodařilo se připojit. Zkuste to znovu.')
    } finally {
      setLoading(false)
    }
  }

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
      {/* Three.js canvas */}
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

      {/* Radial vignette so text is readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 0%, rgba(5,5,8,0.65) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          textAlign: 'center',
          padding: '0 1.5rem',
          maxWidth: '720px',
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
            background: 'rgba(201,169,97,0.08)',
            border: '1px solid rgba(201,169,97,0.25)',
            borderRadius: '999px',
            padding: '0.35rem 1rem',
            marginBottom: '2.5rem',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-gold)',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.75rem',
              color: 'var(--accent-gold)',
              letterSpacing: '0.08em',
            }}
          >
            Beta · Brzy pro první klienty
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
            marginBottom: '0',
          }}
        >
          Váš Excel.
          <br />
          Jako webová aplikace.
        </h1>

        {/* Gold accent line */}
        <div
          className="hero-animate"
          style={{
            width: '3rem',
            height: '1px',
            background: 'var(--accent-gold)',
            opacity: 0.7,
            margin: '2rem auto',
          }}
        />

        {/* Subline */}
        <p
          className="hero-animate"
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: '2.5rem',
          }}
        >
          Pracujete s tabulkami, které se rozrůstají mimo kontrolu?
          <br />
          Proměníme je v aplikaci — přesně pro váš byznys.
        </p>

        {/* Form or success state */}
        {submitted ? (
          <div
            className="hero-animate"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '50%',
                border: '1px solid var(--accent-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-gold)',
                fontSize: '1.125rem',
              }}
            >
              ✓
            </div>
            <p
              style={{
                fontFamily: '"Clash Display", system-ui, sans-serif',
                fontSize: '1.25rem',
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}
            >
              Děkujeme. Ozveme se do 48 hodin.
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Zkontrolujte svůj inbox — poslali jsme vám potvrzovací email.
            </p>
          </div>
        ) : (
          <form
            className="hero-animate"
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '0.75rem',
              maxWidth: '480px',
              margin: '0 auto',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="váš@email.cz"
              required
              className="input-underline"
              style={{ flex: '1 1 220px', minWidth: '200px' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-gold"
              style={{ flex: '0 0 auto' }}
            >
              {loading ? 'Odesílám…' : 'Konzultace zdarma →'}
            </button>
          </form>
        )}

        {error && (
          <p
            style={{
              marginTop: '1rem',
              fontSize: '0.875rem',
              color: '#F87171',
            }}
          >
            {error}
          </p>
        )}

        {/* Scroll indicator */}
        {!submitted && (
          <div
            className="hero-animate"
            style={{
              marginTop: '5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.625rem',
                color: 'var(--text-muted)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              Scrollovat
            </span>
            <div className="scroll-indicator">
              <svg width="16" height="24" viewBox="0 0 16 24" fill="none">
                <rect x="6.5" y="4" width="3" height="6" rx="1.5" fill="var(--accent-gold)" opacity="0.6" />
                <rect x="0.5" y="0.5" width="15" height="23" rx="7.5" stroke="rgba(255,255,255,0.12)" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
