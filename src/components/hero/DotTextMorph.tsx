import { useEffect, useRef } from 'react'

type Props = {
  words: string[]
  intervalMs?: number
  morphMs?: number
  font?: string
  cell?: number
  dotRadius?: number
  fallDistance?: number
  className?: string
}

type Sampled = {
  x: number
  y: number
  phase: number
  seed: number
}

function sampleText(
  text: string,
  font: string,
  cell: number,
  width: number,
  height: number,
): Sampled[] {
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
  const points: Sampled[] = []
  for (let y = 0; y < height; y += cell) {
    for (let x = 0; x < width; x += cell) {
      const i = (y * width + x) * 4
      if (img[i] > 128) {
        points.push({
          x: x + cell / 2,
          y: y + cell / 2,
          phase: Math.random() * Math.PI * 2,
          seed: Math.random(),
        })
      }
    }
  }
  return points
}

function easeInOutQuint(t: number): number {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export default function DotTextMorph({
  words,
  intervalMs = 3200,
  morphMs = 1500,
  font = "'Silkscreen', 'Courier New', monospace",
  cell = 7,
  dotRadius = 2.2,
  fallDistance = 50,
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

    let currentDots: Sampled[] = []
    let outgoingDots: Sampled[] = []
    let wordIndex = 0
    let morphStart = -Infinity
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
      currentDots = sampleText(words[wordIndex], font, cell, width, height)
      outgoingDots = []
      morphStart = -Infinity
    }

    function nextWord() {
      outgoingDots = currentDots
      wordIndex = (wordIndex + 1) % words.length
      currentDots = sampleText(words[wordIndex], font, cell, width, height)
      morphStart = performance.now()
    }

    function scheduleNext() {
      if (scheduled) clearTimeout(scheduled)
      scheduled = window.setTimeout(() => {
        nextWord()
        scheduleNext()
      }, intervalMs)
    }

    function draw(now: number) {
      if (document.hidden) {
        rafId = requestAnimationFrame(draw)
        return
      }

      const morphElapsed = (now - morphStart) / morphMs
      const morphing = morphElapsed >= 0 && morphElapsed <= 1
      const progress = Math.max(0, Math.min(1, morphElapsed))
      const time = now / 1000

      ctx.clearRect(0, 0, width, height)
      const fg = (
        getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() ||
        '10 10 10'
      ).replaceAll(' ', ',')

      const drawDot = (
        d: Sampled,
        offsetY: number,
        alphaMul: number,
        idleAmp: number,
      ) => {
        const breathe = reduced ? 0.85 : Math.sin(time * 1.1 + d.phase) * 0.5 + 0.5

        const jx = reduced
          ? 0
          : Math.sin(time * 0.9 + d.phase * 2.3 + d.seed * 5) * idleAmp
        const jy = reduced
          ? 0
          : Math.cos(time * 0.7 + d.phase * 1.9 + d.seed * 7) * idleAmp

        const x = d.x + jx
        const y = d.y + jy + offsetY
        const radius = dotRadius * (0.75 + breathe * 0.3)
        const alpha = 0.92 * alphaMul

        if (alpha < 0.02) return

        ctx.beginPath()
        ctx.fillStyle = `rgba(${fg}, ${alpha.toFixed(3)})`
        ctx.arc(x, y, Math.max(0.3, radius), 0, Math.PI * 2)
        ctx.fill()
      }

      // outgoing: drift down + fade out (gentle, overlaps with incoming)
      if (morphing && outgoingDots.length) {
        const eOut = easeInOutQuint(progress)
        const offY = eOut * fallDistance
        const alphaOut = smoothstep(1 - progress)
        for (let i = 0; i < outgoingDots.length; i++) {
          drawDot(outgoingDots[i], offY, alphaOut, 0.2)
        }
      }

      // incoming/current: drift in from above + fade in
      if (currentDots.length) {
        let offY = 0
        let alphaIn = 1
        if (morphing) {
          const eIn = easeInOutQuint(progress)
          offY = -fallDistance * (1 - eIn)
          alphaIn = smoothstep(progress)
        }
        const idleAmp = morphing ? 0.25 : 0.6
        for (let i = 0; i < currentDots.length; i++) {
          drawDot(currentDots[i], offY, alphaIn, idleAmp)
        }
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
  }, [words, intervalMs, morphMs, font, cell, dotRadius, fallDistance])

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
