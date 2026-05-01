import { useEffect, useRef } from 'react'

type Props = {
  className?: string
  cell?: number
  baseRadius?: number
  influenceRadius?: number
  influenceStrength?: number
}

export default function DotField({
  className,
  cell,
  baseRadius = 1.1,
  influenceRadius = 220,
  influenceStrength = 4.5,
}: Props) {
  const resolvedCell = cell ?? (typeof window !== 'undefined' && window.innerWidth < 768 ? 32 : 22)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let mouseX = -9999
    let mouseY = -9999
    let targetMouseX = -9999
    let targetMouseY = -9999
    let rafId = 0
    let start = performance.now()

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function onMove(e: MouseEvent) {
      targetMouseX = e.clientX
      targetMouseY = e.clientY
    }

    function onLeave() {
      targetMouseX = -9999
      targetMouseY = -9999
    }

    function draw(now: number) {
      if (document.hidden) {
        rafId = requestAnimationFrame(draw)
        return
      }
      const t = (now - start) / 1000
      mouseX += (targetMouseX - mouseX) * 0.18
      mouseY += (targetMouseY - mouseY) * 0.18

      ctx.clearRect(0, 0, width, height)
      const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '10 10 10'

      const cols = Math.ceil(width / resolvedCell) + 1
      const rows = Math.ceil(height / resolvedCell) + 1
      const offsetX = (width - (cols - 1) * resolvedCell) / 2
      const offsetY = (height - (rows - 1) * resolvedCell) / 2

      const infR2 = influenceRadius * influenceRadius

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = offsetX + i * resolvedCell
          const y = offsetY + j * resolvedCell

          const dx = x - mouseX
          const dy = y - mouseY
          const d2 = dx * dx + dy * dy
          let influence = 0
          if (d2 < infR2) {
            const d = Math.sqrt(d2)
            influence = 1 - d / influenceRadius
          }

          const wave = reduced
            ? 0
            : Math.sin(t * 0.7 + i * 0.18) * Math.cos(t * 0.5 + j * 0.18) * 0.25

          const radius = baseRadius * (1 + wave + influence * influenceStrength)
          const alpha = 0.18 + influence * 0.65

          ctx.beginPath()
          ctx.fillStyle = `rgba(${fg.replaceAll(' ', ',')}, ${alpha.toFixed(3)})`
          ctx.arc(x, y, Math.max(0.3, radius), 0, Math.PI * 2)
          ctx.fill()
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [resolvedCell, baseRadius, influenceRadius, influenceStrength])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
      aria-hidden
    />
  )
}
