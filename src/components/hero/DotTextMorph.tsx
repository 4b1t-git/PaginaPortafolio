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

  let size = Math.min(width / Math.max(text.length, 4) * 1.6, height * 0.7)
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
        points.push({
          x: x + cell / 2,
          y: y + cell / 2,
        })
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
  intervalMs = 2200,
  morphMs = 900,
  font = "'Silkscreen', 'Courier New', monospace",
  cell = 7,
  dotRadius = 2,
  className,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

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
        const f = fromPts[i % fromPts.length] ?? { x: width / 2, y: height / 2 }
        const t = toPts[i % toPts.length] ?? { x: width / 2, y: height / 2 }
        next.push({
          fromX: f.x,
          fromY: f.y,
          toX: t.x,
          toY: t.y,
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
      const t = Math.min(1, (now - morphStart) / morphMs)
      const e = easeInOutCubic(t)

      ctx.clearRect(0, 0, width, height)
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--fg')
        .trim()
      ctx.fillStyle = `rgb(${accent})`

      const jitter = (1 - e) * 8
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]
        const x = d.fromX + (d.toX - d.fromX) * e + (Math.random() - 0.5) * jitter
        const y = d.fromY + (d.toY - d.fromY) * e + (Math.random() - 0.5) * jitter
        const r = dotRadius * (0.6 + Math.random() * 0.6)
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
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
