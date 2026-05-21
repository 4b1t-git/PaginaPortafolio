import { useEffect, useRef } from 'react'
import { createProgram } from '@/lib/webgl'

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

// ───────── Shaders ─────────
// El jitter idle, breathe, flicker y el radio por punto se calculan en el
// vertex shader. El main thread solo sube uniforms y dispara 2 draw calls.

const VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_pos;
in float a_phase;
in float a_seed;

uniform vec2 u_res;
uniform float u_dpr;
uniform float u_time;
uniform float u_offsetY;
uniform float u_alphaMul;
uniform float u_dotRadius;
uniform float u_idleAmp;
uniform int u_reduced;

out float v_alpha;

void main() {
  float breathe = u_reduced == 1 ? 0.7 : sin(u_time * 1.6 + a_phase) * 0.5 + 0.5;
  float flicker = u_reduced == 1 ? 1.0 : sin(u_time * 0.9 + a_phase * 1.7 + a_seed * 6.28) * 0.5 + 0.5;
  float jx = u_reduced == 1 ? 0.0
    : (sin(u_time * 2.1 + a_phase * 3.1) + sin(u_time * 0.7 + a_seed * 9.0)) * u_idleAmp;
  float jy = u_reduced == 1 ? 0.0
    : (cos(u_time * 1.7 + a_phase * 2.3) + cos(u_time * 0.6 + a_seed * 11.0)) * u_idleAmp;

  float x = a_pos.x + jx;
  float y = a_pos.y + jy + u_offsetY;
  float radius = u_dotRadius * (0.55 + breathe * 0.55);

  v_alpha = (0.35 + flicker * 0.65) * u_alphaMul;

  vec2 ndc = vec2((x / u_res.x) * 2.0 - 1.0, 1.0 - (y / u_res.y) * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = max(0.3, radius) * 2.0 * u_dpr;
}
`

const FRAG = /* glsl */ `#version 300 es
precision highp float;

in float v_alpha;
uniform vec3 u_color;
out vec4 outColor;

void main() {
  if (v_alpha < 0.04) discard;
  vec2 pc = gl_PointCoord - 0.5;
  float d = length(pc);
  if (d > 0.5) discard;
  float aa = smoothstep(0.5, 0.4, d);
  outColor = vec4(u_color, min(1.0, v_alpha) * aa);
}
`

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
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    })
    if (!gl) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Amplitud de jitter idle reducida para mantener las letras legibles.
    const idleAmp = 0.4

    const program = createProgram(gl, VERT, FRAG)
    const loc = {
      a_pos: gl.getAttribLocation(program, 'a_pos'),
      a_phase: gl.getAttribLocation(program, 'a_phase'),
      a_seed: gl.getAttribLocation(program, 'a_seed'),
      u_res: gl.getUniformLocation(program, 'u_res'),
      u_dpr: gl.getUniformLocation(program, 'u_dpr'),
      u_time: gl.getUniformLocation(program, 'u_time'),
      u_offsetY: gl.getUniformLocation(program, 'u_offsetY'),
      u_alphaMul: gl.getUniformLocation(program, 'u_alphaMul'),
      u_dotRadius: gl.getUniformLocation(program, 'u_dotRadius'),
      u_idleAmp: gl.getUniformLocation(program, 'u_idleAmp'),
      u_reduced: gl.getUniformLocation(program, 'u_reduced'),
      u_color: gl.getUniformLocation(program, 'u_color'),
    }

    // Un VAO + buffer por set (current / outgoing). bufferData se reemplaza
    // al cambiar de palabra; los punteros del VAO siguen válidos.
    function makeSet() {
      const vao = gl!.createVertexArray()!
      const buf = gl!.createBuffer()!
      gl!.bindVertexArray(vao)
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf)
      gl!.enableVertexAttribArray(loc.a_pos)
      gl!.vertexAttribPointer(loc.a_pos, 2, gl!.FLOAT, false, 16, 0)
      gl!.enableVertexAttribArray(loc.a_phase)
      gl!.vertexAttribPointer(loc.a_phase, 1, gl!.FLOAT, false, 16, 8)
      gl!.enableVertexAttribArray(loc.a_seed)
      gl!.vertexAttribPointer(loc.a_seed, 1, gl!.FLOAT, false, 16, 12)
      gl!.bindVertexArray(null)
      return { vao, buf }
    }
    const currentSet = makeSet()
    const outgoingSet = makeSet()
    let currentCount = 0
    let outgoingCount = 0

    function upload(buf: WebGLBuffer, dots: Sampled[]) {
      const arr = new Float32Array(dots.length * 4)
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i]
        arr[i * 4] = d.x
        arr[i * 4 + 1] = d.y
        arr[i * 4 + 2] = d.phase
        arr[i * 4 + 3] = d.seed
      }
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf)
      gl!.bufferData(gl!.ARRAY_BUFFER, arr, gl!.DYNAMIC_DRAW)
      return dots.length
    }

    gl.enable(gl.BLEND)
    // Canvas transparente sobre el contenido del hero: alpha no premultiplicado.
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    // Color de tema cacheado — relee solo al cambiar data-theme.
    function readFg(): number[] {
      const fg = getComputedStyle(document.documentElement).getPropertyValue('--fg').trim() || '10 10 10'
      const p = fg.split(/\s+|,/).map((n) => parseInt(n, 10) || 0)
      return [(p[0] || 0) / 255, (p[1] || 0) / 255, (p[2] || 0) / 255]
    }
    let fgCache = readFg()
    const themeObserver = new MutationObserver(() => {
      fgCache = readFg()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    let currentDots: Sampled[] = []
    let wordIndex = 0
    let morphStart = -Infinity
    let scheduled: number | null = null
    let rafId = 0
    let width = 0
    let height = 0
    let visible = true
    // Transición pendiente: nextWord() solo prepara los puntos nuevos; el
    // swap y el seteo de morphStart se hacen en draw() con el `now` del RAF.
    let pendingNew: Sampled[] | null = null
    let pendingOut: Sampled[] | null = null
    let effCell = cell

    function computeEffCell(w: number) {
      if (w < 480) return Math.max(3, Math.round(cell * 0.55))
      if (w < 768) return Math.max(4, Math.round(cell * 0.7))
      return cell
    }

    function resize() {
      const r = wrap.getBoundingClientRect()
      width = Math.max(320, Math.floor(r.width))
      height = Math.max(120, Math.floor(r.height))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      gl!.viewport(0, 0, canvas.width, canvas.height)
      effCell = computeEffCell(width)
      currentDots = sampleText(words[wordIndex], font, effCell, width, height)
      currentCount = upload(currentSet.buf, currentDots)
      outgoingCount = 0
      morphStart = -Infinity
      pendingNew = null
      pendingOut = null
    }

    function nextWord() {
      wordIndex = (wordIndex + 1) % words.length
      pendingOut = currentDots
      pendingNew = sampleText(words[wordIndex], font, effCell, width, height)
    }

    function scheduleNext() {
      if (scheduled) clearTimeout(scheduled)
      scheduled = window.setTimeout(() => {
        nextWord()
        scheduleNext()
      }, intervalMs)
    }

    function drawSet(
      set: { vao: WebGLVertexArrayObject },
      n: number,
      offsetY: number,
      alphaMul: number,
    ) {
      if (n === 0) return
      gl!.uniform1f(loc.u_offsetY, offsetY)
      gl!.uniform1f(loc.u_alphaMul, alphaMul)
      gl!.bindVertexArray(set.vao)
      gl!.drawArrays(gl!.POINTS, 0, n)
    }

    function draw(now: number) {
      if (document.hidden || !visible) {
        rafId = requestAnimationFrame(draw)
        return
      }

      // Aplica la transición pendiente con el timestamp del RAF actual.
      if (pendingNew) {
        outgoingCount = upload(outgoingSet.buf, pendingOut || [])
        currentDots = pendingNew
        currentCount = upload(currentSet.buf, pendingNew)
        morphStart = now
        pendingNew = null
        pendingOut = null
      }

      const morphElapsed = (now - morphStart) / morphMs
      const morphing = morphElapsed <= 1 && morphElapsed >= 0
      const progress = Math.max(0, Math.min(1, morphElapsed))
      const time = now / 1000

      gl!.clearColor(0, 0, 0, 0)
      gl!.clear(gl!.COLOR_BUFFER_BIT)

      gl!.useProgram(program)
      gl!.uniform2f(loc.u_res, width, height)
      gl!.uniform1f(loc.u_dpr, dpr)
      gl!.uniform1f(loc.u_time, time)
      gl!.uniform1f(loc.u_dotRadius, dotRadius)
      gl!.uniform1f(loc.u_idleAmp, idleAmp)
      gl!.uniform1i(loc.u_reduced, reduced ? 1 : 0)
      gl!.uniform3f(loc.u_color, fgCache[0], fgCache[1], fgCache[2])

      // outgoing: deriva hacia abajo + fade out
      if (morphing && outgoingCount) {
        const eOut = easeInOutQuint(progress)
        drawSet(outgoingSet, outgoingCount, eOut * fallDistance, smoothstep(1 - progress))
      }

      // current: entra desde arriba + fade in
      let offY = 0
      let alphaIn = 1
      if (morphing) {
        const eIn = easeInOutQuint(progress)
        offY = -fallDistance * (1 - eIn)
        alphaIn = smoothstep(progress)
      }
      drawSet(currentSet, currentCount, offY, alphaIn)

      rafId = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true
      },
      { threshold: 0 },
    )
    io.observe(wrap)
    resize()
    scheduleNext()
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      if (scheduled) clearTimeout(scheduled)
      ro.disconnect()
      io.disconnect()
      themeObserver.disconnect()
      gl.deleteProgram(program)
      gl.deleteBuffer(currentSet.buf)
      gl.deleteBuffer(outgoingSet.buf)
      gl.deleteVertexArray(currentSet.vao)
      gl.deleteVertexArray(outgoingSet.vao)
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
