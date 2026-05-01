import { useEffect, useRef } from 'react'

type Props = {
  className?: string
  cell?: number
}

const layers = [
  { amp: 70, freq: 0.0038, phase: 0.0, speed: 0.18, base: 0.5, density: 0.55 },
  { amp: 110, freq: 0.0029, phase: 1.3, speed: 0.24, base: 0.62, density: 0.8 },
  { amp: 150, freq: 0.0022, phase: 2.8, speed: 0.16, base: 0.78, density: 1.0 },
]

function hash(i: number, j: number): number {
  let h = (i * 374761393) ^ (j * 668265263)
  h = (h ^ (h >>> 13)) >>> 0
  h = (h * 1274126177) >>> 0
  return (h % 100000) / 100000
}

export default function DotMountains({ className, cell = 8 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.innerWidth < 768
    const stepCell = isMobile ? Math.max(cell, 11) : cell

    let width = 0
    let height = 0
    let mouseX = -9999
    let mouseY = -9999
    let targetMX = -9999
    let targetMY = -9999
    let rafId = 0

    function resize() {
      const r = wrap.getBoundingClientRect()
      width = Math.floor(r.width)
      height = Math.floor(r.height)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function onMove(e: globalThis.MouseEvent) {
      const r = wrap.getBoundingClientRect()
      targetMX = e.clientX - r.left
      targetMY = e.clientY - r.top
    }
    function onLeave() {
      targetMX = -9999
      targetMY = -9999
    }

    function draw(now: number) {
      if (document.hidden) {
        rafId = requestAnimationFrame(draw)
        return
      }
      const t = now / 1000
      mouseX += (targetMX - mouseX) * 0.18
      mouseY += (targetMY - mouseY) * 0.18

      ctx.clearRect(0, 0, width, height)
      const fg = (
        getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() ||
        '10 10 10'
      ).replaceAll(' ', ',')

      const cols = Math.ceil(width / stepCell) + 1
      const rows = Math.ceil(height / stepCell) + 1

      const heights = new Array(cols)
      for (let i = 0; i < cols; i++) {
        const x = i * stepCell
        heights[i] = layers.map((l) => {
          const a = Math.sin(x * l.freq + l.phase + t * l.speed)
          const b = Math.sin(x * l.freq * 1.7 + l.phase * 0.5 + t * l.speed * 0.6)
          const wave = (a + 0.5 * b) / 1.5
          return height * l.base - l.amp * wave
        })
      }

      const mouseR = 180
      const mouseR2 = mouseR * mouseR

      for (let i = 0; i < cols; i++) {
        const x = i * stepCell + stepCell / 2
        const hs = heights[i]
        for (let j = 0; j < rows; j++) {
          const y = j * stepCell + stepCell / 2

          let density = 0
          for (let li = 0; li < layers.length; li++) {
            const sh = hs[li]
            if (y > sh) {
              const into = Math.min(1, (y - sh) / 220)
              density += layers[li].density * (0.25 + 0.75 * into)
            }
          }
          if (density < 0.04) continue
          density = Math.min(1, density)

          const r = hash(i, j)
          if (r > density + 0.18) continue

          const ph = r * Math.PI * 2
          const breathe = reduced ? 0.7 : Math.sin(t * 1.3 + ph) * 0.5 + 0.5
          const flicker = reduced ? 1 : Math.sin(t * 0.7 + ph * 1.8) * 0.5 + 0.5

          const dx = x - mouseX
          const dy = y - mouseY
          const md2 = dx * dx + dy * dy
          let mouseInfluence = 0
          if (md2 < mouseR2) {
            mouseInfluence = 1 - Math.sqrt(md2) / mouseR
          }

          const alpha =
            density * (0.22 + flicker * 0.5) + mouseInfluence * 0.45
          const radius =
            (0.7 + breathe * 0.55) *
            (0.55 + density * 0.55) *
            (1 + mouseInfluence * 1.4)

          if (alpha < 0.03) continue

          ctx.beginPath()
          ctx.fillStyle = `rgba(${fg}, ${Math.min(0.95, alpha).toFixed(3)})`
          ctx.arc(x, y, Math.max(0.35, radius), 0, Math.PI * 2)
          ctx.fill()
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [cell])

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}
