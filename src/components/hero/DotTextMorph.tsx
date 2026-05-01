import { useEffect, useRef } from 'react'

type Props = {
  words: string[]
  intervalMs?: number
  morphMs?: number
  font?: string
  cell?: number
  dotRadius?: number
  className?: string
}

type Dot = {
  fromX: number
  fromY: number
  toX: number
  toY: number
  phase: number
  seed: number
  active: boolean
}

function sampleText(
  text: string,
  font: string,
  cell: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const off = document.createElement('canvas')
  off.width = width
  off.height = height
  const ctx = off.getContext('2d', { willReadFrequently: true })!
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let size = Math.min((width / Math.max(text.length, 4)) * 1.6, height * 0.7)
  ctx.font = `${size}px ${font}`
  let metrics = ctx.measureText(text)
  while (metrics.width > width * 0.92 && size > 12) {
    size -= 4
    ctx.font = `${size}px ${font}`
    metrics = ctx.measureText(text)
  }

  ctx.fillText(text, width / 2, height / 2)

  const img = ctx.getImageData(0, 0, width, height).data
  const points: { x: number; y: number }[] = []
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      const i = (y * width + x) * 4
      if (img[i] > 128) {
        points.push({ x: x + cell / 2, y: y + cell / 2 })
      }
    }
  }
  return points
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export default function DotTextMorph({
  words,
  intervalMs = 2600,
  morphMs = 1100,
  font = "'Silkscreen', 'Courier New', monospace",
  cell = 7,
  dotRadius = 2.2,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let dots: Dot[] = []
    let wordIndex = 0
    let morphStart = performance.now()
    let scheduled: number | null = null
    let rafId: number
    let width = 0
    let height = 0

    function resize() {
      const r = wrap.getBoundingClientRect()
      width = Math.max(320, Math.floor(r.width))
      height = Math.max(120, Math.floor(r.height))
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildDots(words[wordIndex], words[wordIndex])
      morphStart = performance.now() - morphMs
    }

    function buildDots(fromText: string, toText: string) {
      const fromPts = sampleText(fromText, font, cell, width, height)
      const toPts = sampleText(toText, font, cell, width, height)
      const max = Math.max(fromPts.length, toPts.length)
      const next: Dot[] = []
      for (let i = 0; i < max; i++) {
        const prev = dots[i]
        const f = fromPts[i % fromPts.length] ?? { x: width / 2, y: height / 2 }
        const t = toPts[i % toPts.length] ?? { x: width / 2, y: height / 2 }
        next.push({
          fromX: f.x,
          fromY: f.y,
          toX: t.x,
          toY: t.y,
          phase: prev?.phase ?? Math.random() * Math.PI * 2,
          seed: prev?.seed ?? Math.random(),
          active: i < toPts.length || i < fromPts.length,
        })
      }
      dots = next
    }

    function scheduleNext() {
      if (scheduled) clearTimeout(scheduled)
      scheduled = window.setTimeout(() => {
        const fromIdx = wordIndex
        wordIndex = (wordIndex + 1) % words.length
        buildDots(words[fromIdx], words[wordIndex])
        morphStart = performance.now()
        scheduleNext()
      }, intervalMs)
    }

    function draw(now: number) {
      if (document.hidden) {
        rafId = requestAnimationFrame(draw)
        return
      }
      const elapsedMorph = Math.min(1, (now - morphStart) / morphMs)
      const e = easeInOutCubic(elapsedMorph)
      const time = now / 1000

      ctx.clearRect(0, 0, width, height)
      const fg = getComputedStyle(document.documentElement)
        .getPropertyValue('--fg')
        .trim() || '10 10 10'
      const fgRgb = fg.replaceAll(' ', ',')

      const morphJitter = (1 - e) * 7

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]

        const baseX = d.fromX + (d.toX - d.fromX) * e
        const baseY = d.fromY + (d.toY - d.fromY) * e

        const breathe = reduced ? 0 : Math.sin(time * 1.6 + d.phase) * 0.5 + 0.5
        const flicker = reduced
          ? 0
          : Math.sin(time * 0.9 + d.phase * 1.7 + d.seed * 6.28) * 0.5 + 0.5

        const idleJitter = reduced ? 0 : 0.9
        const jx =
          (Math.sin(time * 2.1 + d.phase * 3.1) + Math.sin(time * 0.7 + d.seed * 9)) *
          idleJitter
        const jy =
          (Math.cos(time * 1.7 + d.phase * 2.3) + Math.cos(time * 0.6 + d.seed * 11)) *
          idleJitter

        const morphJx = (Math.random() - 0.5) * morphJitter
        const morphJy = (Math.random() - 0.5) * morphJitter

        const x = baseX + jx + morphJx
        const y = baseY + jy + morphJy

        const radius = dotRadius * (0.55 + breathe * 0.55)
        const alpha = 0.35 + flicker * 0.65

        const dropOut = !reduced && flicker < 0.08 ? 0 : 1
        if (dropOut === 0) continue

        ctx.beginPath()
        ctx.fillStyle = `rgba(${fgRgb}, ${alpha.toFixed(3)})`
        ctx.arc(x, y, Math.max(0.3, radius), 0, Math.PI * 2)
        ctx.fill()
      }
      rafId = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()
    scheduleNext()
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      if (scheduled) clearTimeout(scheduled)
      ro.disconnect()
    }
  }, [words, intervalMs, morphMs, font, cell, dotRadius])

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  )
}
