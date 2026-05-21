'use client'

import { useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Seeded pseudo-random (deterministic renders on every resize)
// ─────────────────────────────────────────────────────────────────────────────
const sr = (seed: number) => {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-renderers
// ─────────────────────────────────────────────────────────────────────────────

function drawUICard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  title: string
) {
  ctx.save()
  ctx.shadowBlur = 18
  ctx.shadowColor = 'rgba(212,175,55,0.3)'
  ctx.fillStyle = 'rgba(8,14,50,0.78)'
  roundRect(ctx, x, y, w, h, 7)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.shadowBlur = 8
  ctx.shadowColor = 'rgba(212,175,55,0.5)'
  ctx.strokeStyle = 'rgba(212,175,55,0.55)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, w, h, 7)
  ctx.stroke()
  ctx.restore()

  // Header stripe
  ctx.strokeStyle = 'rgba(212,175,55,0.2)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x + 8, y + h * 0.28)
  ctx.lineTo(x + w - 8, y + h * 0.28)
  ctx.stroke()

  ctx.fillStyle = 'rgba(212,175,55,0.75)'
  ctx.font = `600 ${Math.round(h * 0.14)}px 'DM Sans', sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(title, x + 10, y + h * 0.2)

  const lineW = [0.75, 0.5, 0.65, 0.38]
  lineW.forEach((lw, i) => {
    ctx.fillStyle = `rgba(212,175,55,${0.22 - i * 0.03})`
    ctx.fillRect(x + 10, y + h * 0.38 + i * h * 0.155, lw * (w - 20), h * 0.06)
  })
}

function drawBarChart(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
) {
  ctx.save()
  ctx.shadowBlur = 12
  ctx.shadowColor = 'rgba(212,175,55,0.3)'
  ctx.fillStyle = 'rgba(8,14,50,0.78)'
  roundRect(ctx, x, y, w, h, 7)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.shadowBlur = 8
  ctx.shadowColor = 'rgba(212,175,55,0.45)'
  ctx.strokeStyle = 'rgba(212,175,55,0.5)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, w, h, 7)
  ctx.stroke()
  ctx.restore()

  const bars = [0.42, 0.68, 0.55, 0.88, 0.62]
  const pad = 10
  const bSpacing = (w - pad * 2) / bars.length
  const bW = bSpacing * 0.55
  const chartH = h - pad * 2.8
  const baseY = y + h - pad * 1.4

  bars.forEach((bh, i) => {
    const bx = x + pad + i * bSpacing + bSpacing * 0.22
    const by = baseY - bh * chartH
    const g = ctx.createLinearGradient(0, by, 0, baseY)
    g.addColorStop(0, 'rgba(255,220,80,0.92)')
    g.addColorStop(1, 'rgba(212,175,55,0.28)')
    ctx.save()
    ctx.shadowBlur = 10
    ctx.shadowColor = 'rgba(212,175,55,0.55)'
    ctx.fillStyle = g
    roundRect(ctx, bx, by, bW, bh * chartH, 2)
    ctx.fill()
    ctx.restore()
  })

  ctx.strokeStyle = 'rgba(212,175,55,0.2)'
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(x + pad, baseY)
  ctx.lineTo(x + w - pad, baseY)
  ctx.stroke()
}

function drawIconGrid(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
) {
  const iconSz = Math.min(w * 0.4, h * 0.42)
  const gap = (w - iconSz * 2) / 3

  ;[[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([col, row], i) => {
    const ix = x + gap + col * (iconSz + gap)
    const iy = y + h * 0.06 + row * (iconSz + h * 0.1)
    ctx.save()
    ctx.shadowBlur = 10
    ctx.shadowColor = 'rgba(212,175,55,0.45)'
    ctx.strokeStyle = `rgba(212,175,55,${0.55 + i * 0.06})`
    ctx.lineWidth = 0.9
    roundRect(ctx, ix, iy, iconSz, iconSz, 4)
    ctx.stroke()
    ctx.restore()

    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(212,175,55,0.35)'
      ctx.beginPath()
      ctx.arc(ix + iconSz / 2, iy + iconSz / 2, iconSz * 0.2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = 'rgba(212,175,55,0.3)'
      ctx.fillRect(ix + iconSz * 0.18, iy + iconSz * 0.38, iconSz * 0.64, iconSz * 0.1)
      ctx.fillRect(ix + iconSz * 0.18, iy + iconSz * 0.58, iconSz * 0.42, iconSz * 0.1)
    }
  })
}

function drawCursor(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, sz: number
) {
  ctx.save()
  ctx.shadowBlur = 14
  ctx.shadowColor = 'rgba(212,175,55,0.75)'
  ctx.fillStyle = 'rgba(242,210,70,0.88)'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + sz)
  ctx.lineTo(x + sz * 0.3, y + sz * 0.67)
  ctx.lineTo(x + sz * 0.44, y + sz * 0.98)
  ctx.lineTo(x + sz * 0.57, y + sz * 0.92)
  ctx.lineTo(x + sz * 0.41, y + sz * 0.61)
  ctx.lineTo(x + sz * 0.72, y + sz * 0.61)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ─────────────────────────────────────────────────────────────────────────────
// Main draw
// ─────────────────────────────────────────────────────────────────────────────

function draw(canvas: HTMLCanvasElement, W: number, H: number) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  ctx.clearRect(0, 0, W, H)

  // — Background depth —
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, W * 0.65)
  bg.addColorStop(0, 'rgba(18,35,95,0.4)')
  bg.addColorStop(1, 'rgba(7,9,30,0)')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // — Scatter particles —
  for (let i = 0; i < 45; i++) {
    const px = sr(i * 17.3) * W
    const py = sr(i * 11.7) * H
    const pr = sr(i * 5.1) * 1.4 + 0.3
    const pa = sr(i * 7.3) * 0.35 + 0.08
    ctx.fillStyle = `rgba(212,175,55,${pa})`
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
  }

  // ── EXCEL GRID ─────────────────────────────────────────────────────────────
  const GX = W * 0.018
  const GY = H * 0.06
  const GW = W * 0.28
  const GH = H * 0.88
  const COLS = 4
  const ROWS = 13
  const cW = GW / COLS
  const cH = GH / ROWS

  // Background
  ctx.save()
  ctx.shadowBlur = 30
  ctx.shadowColor = 'rgba(212,175,55,0.2)'
  ctx.fillStyle = 'rgba(6,12,42,0.88)'
  roundRect(ctx, GX, GY, GW, GH, 5)
  ctx.fill()
  ctx.restore()

  // Column header
  const hg = ctx.createLinearGradient(GX, GY, GX + GW, GY + cH)
  hg.addColorStop(0, 'rgba(212,175,55,0.9)')
  hg.addColorStop(1, 'rgba(170,138,30,0.8)')
  ctx.fillStyle = hg
  ctx.beginPath()
  ctx.moveTo(GX + 5, GY)
  ctx.lineTo(GX + GW - 5, GY)
  ctx.quadraticCurveTo(GX + GW, GY, GX + GW, GY + 5)
  ctx.lineTo(GX + GW, GY + cH)
  ctx.lineTo(GX, GY + cH)
  ctx.lineTo(GX, GY + 5)
  ctx.quadraticCurveTo(GX, GY, GX + 5, GY)
  ctx.closePath()
  ctx.fill()

  // Header labels
  ctx.fillStyle = 'rgba(0,0,0,0.65)'
  ctx.font = `bold ${Math.round(cH * 0.38)}px monospace`
  ctx.textAlign = 'center'
  ;['A', 'B', 'C', 'D'].forEach((l, i) => {
    ctx.fillText(l, GX + i * cW + cW * 0.5, GY + cH * 0.67)
  })

  // Row tints + data
  const rowBars = [0.62, 0.35, 0.78, 0.48, 0.91, 0.55, 0.38, 0.72, 0.60, 0.44, 0.83, 0.30]
  const nums1   = [247, 831, 512, 94, 1204, 388, 67, 943, 271, 548, 1050, 185]
  const pcts    = [18, 42, 7, 61, 33, 15, 78, 29, 54, 11, 66, 39]

  for (let r = 1; r < ROWS; r++) {
    if (r % 2 === 0) {
      ctx.fillStyle = 'rgba(212,175,55,0.04)'
      ctx.fillRect(GX, GY + r * cH, GW, cH)
    }
    const idx = (r - 1) % rowBars.length
    const barW = rowBars[idx] * (cW - 8)

    ctx.fillStyle = 'rgba(212,175,55,0.42)'
    ctx.fillRect(GX + cW * 2 + 4, GY + r * cH + cH * 0.55, barW, cH * 0.24)

    ctx.fillStyle = 'rgba(212,175,55,0.48)'
    ctx.font = `${Math.round(cH * 0.31)}px monospace`
    ctx.textAlign = 'right'
    ctx.fillText(`${nums1[idx]}`, GX + cW - 5, GY + r * cH + cH * 0.67)
    ctx.fillText(`${pcts[idx]}%`, GX + cW * 2 - 5, GY + r * cH + cH * 0.67)
  }

  // Grid lines
  ctx.strokeStyle = 'rgba(212,175,55,0.16)'
  ctx.lineWidth = 0.5
  for (let r = 1; r <= ROWS; r++) {
    ctx.beginPath()
    ctx.moveTo(GX, GY + r * cH)
    ctx.lineTo(GX + GW, GY + r * cH)
    ctx.stroke()
  }
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath()
    ctx.moveTo(GX + c * cW, GY)
    ctx.lineTo(GX + c * cW, GY + GH)
    ctx.stroke()
  }

  // Border glow
  ctx.save()
  ctx.shadowBlur = 28
  ctx.shadowColor = 'rgba(212,175,55,0.55)'
  ctx.strokeStyle = 'rgba(212,175,55,0.65)'
  ctx.lineWidth = 1.5
  roundRect(ctx, GX, GY, GW, GH, 5)
  ctx.stroke()
  ctx.restore()

  // ── GOLDEN FLOW CURVES ─────────────────────────────────────────────────────
  const SX   = GX + GW          // stream start X
  const EX   = W * 0.875        // stream end X
  const MIDX = W * 0.515        // convergence center X
  const MIDY = H * 0.47         // convergence center Y

  const curves = [
    { sy: H * 0.10, ey: H * 0.05, t: 2.5,  op: 0.42 },
    { sy: H * 0.22, ey: H * 0.18, t: 4.5,  op: 0.60 },
    { sy: H * 0.34, ey: H * 0.32, t: 7.5,  op: 0.88 },
    { sy: H * 0.47, ey: H * 0.50, t: 10.0, op: 1.00 }, // main
    { sy: H * 0.60, ey: H * 0.64, t: 7.0,  op: 0.82 },
    { sy: H * 0.72, ey: H * 0.76, t: 4.5,  op: 0.58 },
    { sy: H * 0.84, ey: H * 0.89, t: 2.5,  op: 0.35 },
  ]

  const glowLayers = [
    { extra: 32, am: 0.045 },
    { extra: 16, am: 0.10  },
    { extra: 5,  am: 0.28  },
    { extra: 0,  am: 1.00  },
  ]

  curves.forEach(cv => {
    const cp1x = SX  + (MIDX - SX)  * 0.52
    const cp1y = cv.sy + (MIDY - cv.sy) * 0.30
    const cp2x = MIDX + (EX   - MIDX) * 0.48
    const cp2y = cv.ey + (MIDY - cv.ey) * 0.38

    glowLayers.forEach(layer => {
      ctx.beginPath()
      ctx.moveTo(SX, cv.sy)
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, EX, cv.ey)

      const g = ctx.createLinearGradient(SX, 0, EX, 0)
      const a = cv.op * layer.am
      g.addColorStop(0,    `rgba(212,175,55,${a * 0.75})`)
      g.addColorStop(0.35, `rgba(240,200,78,${a})`)
      g.addColorStop(0.52, `rgba(255,232,90,${a * 1.3})`)
      g.addColorStop(0.72, `rgba(238,196,70,${a * 0.9})`)
      g.addColorStop(1,    `rgba(212,175,55,${a * 0.45})`)

      ctx.strokeStyle = g
      ctx.lineWidth   = cv.t + layer.extra
      ctx.lineCap     = 'round'
      ctx.stroke()
    })
  })

  // Central glow orb
  const orb = ctx.createRadialGradient(MIDX, MIDY, 0, MIDX, MIDY, H * 0.25)
  orb.addColorStop(0,   'rgba(255,230,90,0.30)')
  orb.addColorStop(0.4, 'rgba(212,175,55,0.10)')
  orb.addColorStop(1,   'rgba(212,175,55,0)')
  ctx.fillStyle = orb
  ctx.beginPath()
  ctx.arc(MIDX, MIDY, H * 0.25, 0, Math.PI * 2)
  ctx.fill()

  // Floating code tag in center
  ctx.save()
  ctx.font = `bold ${Math.round(H * 0.024)}px monospace`
  ctx.fillStyle = 'rgba(255,232,90,0.62)'
  ctx.textAlign = 'center'
  ctx.fillText('{ =18% }', MIDX + W * 0.015, MIDY - H * 0.095)
  ctx.restore()

  // Data tag bubbles
  const tags = [
    { x: MIDX - W * 0.05, y: MIDY + H * 0.14, txt: '▶  247 řádků' },
    { x: MIDX + W * 0.07, y: MIDY - H * 0.05, txt: '⚡ API ready' },
  ]
  tags.forEach(tag => {
    ctx.save()
    ctx.font = `${Math.round(H * 0.018)}px monospace`
    ctx.fillStyle = 'rgba(212,175,55,0.5)'
    ctx.textAlign = 'center'
    ctx.fillText(tag.txt, tag.x, tag.y)
    ctx.restore()
  })

  // ── RIGHT-SIDE UI ELEMENTS ─────────────────────────────────────────────────
  const UIX = EX + W * 0.006
  const UIW = W - UIX - W * 0.01

  drawUICard(ctx, UIX, H * 0.04, UIW, H * 0.30, 'Dashboard')
  drawIconGrid(ctx, UIX, H * 0.38, UIW, H * 0.22)
  drawBarChart(ctx, UIX, H * 0.64, UIW, H * 0.30)

  // Floating cursor
  drawCursor(ctx, W * 0.575, H * 0.53, H * 0.042)
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default function V3Page() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const redraw = () => {
      const W = container.clientWidth
      const H = container.clientHeight
      if (W > 0 && H > 0) draw(canvas, W, H)
    }

    redraw()
    const ro = new ResizeObserver(redraw)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&display=swap');

        .v3 { font-family: 'DM Sans', sans-serif; }
        .v3 * { box-sizing: border-box; margin: 0; padding: 0; }

        .v3-link {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(255,255,255,0.65);
          text-decoration: none;
          transition: color 0.22s;
        }
        .v3-link:hover { color: #D4AF37; }

        .v3-btn-fill {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.13em; text-transform: uppercase;
          padding: 17px 38px; border-radius: 100px;
          background: #D4AF37; color: #000;
          border: none; cursor: pointer;
          box-shadow: 0 8px 28px rgba(212,175,55,0.28);
          transition: background 0.22s, box-shadow 0.22s, transform 0.18s;
        }
        .v3-btn-fill:hover {
          background: #F0D060;
          box-shadow: 0 12px 40px rgba(212,175,55,0.5);
          transform: translateY(-2px);
        }
        .v3-btn-outline {
          font-family: 'DM Sans', sans-serif;
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.13em; text-transform: uppercase;
          padding: 17px 38px; border-radius: 100px;
          background: transparent; color: #D4AF37;
          border: 1.5px solid rgba(212,175,55,0.55);
          cursor: pointer;
          transition: background 0.22s, border-color 0.22s, transform 0.18s;
        }
        .v3-btn-outline:hover {
          background: rgba(212,175,55,0.09);
          border-color: #D4AF37;
          transform: translateY(-2px);
        }
      `}</style>

      <div className="v3" style={{
        position: 'fixed', inset: 0,
        background: '#07091E',
        overflow: 'hidden',
        zIndex: 50,
      }}>
        {/* Deep-space background gradient */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: [
            'radial-gradient(ellipse 90% 70% at 30% 50%, rgba(18,38,100,0.38) 0%, transparent 65%)',
            'radial-gradient(ellipse 60% 50% at 75% 80%, rgba(8,14,50,0.3) 0%, transparent 70%)',
          ].join(', '),
        }} />

        {/* ── NAVBAR ─────────────────────────────────────────────────────── */}
        <nav style={{
          position: 'relative', zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 60px',
          height: 72,
          borderBottom: '1px solid rgba(212,175,55,0.1)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700, fontSize: 21,
              color: '#fff', letterSpacing: '-0.02em',
            }}>
              jede.online
            </span>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#D4AF37',
              boxShadow: '0 0 12px rgba(212,175,55,0.9)',
              marginLeft: 3, marginBottom: 9,
              display: 'inline-block',
              animation: 'v3pulse 2.4s ease-in-out infinite',
            }} />
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
            {['Služby', 'Jak to funguje', 'Reference', 'Kontakt'].map(l => (
              <a key={l} href="#" className="v3-link">{l}</a>
            ))}
          </div>
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────────── */}
        <main style={{
          display: 'flex',
          height: 'calc(100vh - 72px)',
          position: 'relative', zIndex: 10,
        }}>
          {/* LEFT — Canvas */}
          <div ref={containerRef} style={{
            flex: '0 0 56%',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <canvas ref={canvasRef} style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
            }} />
          </div>

          {/* RIGHT — Text */}
          <div style={{
            flex: '0 0 44%',
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '0 64px 0 32px',
          }}>
            {/* Eyebrow */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              marginBottom: 26,
            }}>
              <span style={{
                display: 'inline-block', width: 34, height: 1,
                background: 'rgba(212,175,55,0.65)',
              }} />
              <span style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 11, fontWeight: 500,
                letterSpacing: '0.22em', textTransform: 'uppercase',
                color: 'rgba(212,175,55,0.8)',
              }}>
                Transformace dat
              </span>
            </div>

            {/* Headline */}
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 'clamp(44px, 5.2vw, 78px)',
              lineHeight: 0.94,
              color: '#fff',
              letterSpacing: '0.015em',
              marginBottom: 28,
            }}>
              ZMĚŇTE SVÁ DATA<br />
              V EXCELENTNÍ<br />
              WEBY.<br />
              <span style={{ color: '#D4AF37' }}>
                ROZJEĎTE SVŮJ<br />BYZNYS ONLINE.
              </span>
            </h1>

            {/* Body */}
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15, lineHeight: 1.78,
              color: 'rgba(255,255,255,0.58)',
              marginBottom: 44, maxWidth: 390,
            }}>
              Vaše složité Excel tabulky proměníme v rychlé, responzivní
              a funkční webové aplikace. Nebo vám navrhneme kompletní
              webové řešení na klíč.{' '}
              <span style={{ color: 'rgba(212,175,55,0.9)', fontWeight: 500 }}>
                Prostě to jede.
              </span>
            </p>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <button className="v3-btn-fill">Vytvořit nový web</button>
              <button className="v3-btn-outline">Převést Excel do aplikace</button>
            </div>

            {/* Stats row */}
            <div style={{
              marginTop: 54,
              paddingTop: 32,
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', gap: 40, alignItems: 'flex-start',
            }}>
              {[
                { n: '48h',  l: 'Rychlý start' },
                { n: '100%', l: 'Na míru' },
                { n: '∞',    l: 'Škálovatelné' },
              ].map(s => (
                <div key={s.l}>
                  <div style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 26, color: '#D4AF37',
                    letterSpacing: '0.03em',
                    textShadow: '0 0 20px rgba(212,175,55,0.4)',
                  }}>
                    {s.n}
                  </div>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 10, fontWeight: 500,
                    letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.35)',
                    marginTop: 3,
                  }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Keyframes */}
        <style>{`
          @keyframes v3pulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 12px rgba(212,175,55,0.9); }
            50%       { opacity: 0.7; box-shadow: 0 0 20px rgba(212,175,55,0.5); }
          }
        `}</style>
      </div>
    </>
  )
}
