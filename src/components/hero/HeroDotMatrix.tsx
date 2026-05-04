import { useEffect, useMemo, useRef, useState } from 'react'

// Halftone procedural en canvas. Sustituye al fondo de montañas del hero.
// Modos: text / image / shape. Onda horizontal gaussiana periódica.
// Movimiento orgánico vía simplex 3D inline (sin dependencia externa).
// Default: shape = "mountains" — 3 capas senoidales animadas.

type Mode = 'text' | 'image' | 'shape'
type Shape = 'mountains' | 'circle' | 'ring' | 'sine' | 'world' | 'grid' | 'spiral'

type Config = {
  mode: Mode
  text: string
  textFont: string
  shape: Shape
  imageUrl: string
  baseRadius: number
  cell: number
  noiseSpeed: number
  amplitude: number
  waveSeconds: number
  dotColor: string
  bgColor: string
  useThemeColors: boolean
  invertLuminance: boolean
}

const STORAGE_KEY = 'pp:fx:v2'

const DEFAULTS: Config = {
  mode: 'shape',
  text: 'IGNACIO',
  textFont: 'Inter',
  shape: 'mountains',
  imageUrl: '',
  baseRadius: 1.4,
  cell: 8,
  noiseSpeed: 1,
  amplitude: 1.5,
  waveSeconds: 6,
  dotColor: '#0a0a0a',
  bgColor: '#f0ead6',
  useThemeColors: true,
  invertLuminance: false,
}

const FONTS = ['Inter', 'Instrument Serif', 'Fraunces', 'JetBrains Mono', 'Space Grotesk']
const SHAPES: { value: Shape; label: string }[] = [
  { value: 'mountains', label: 'Montañas (3 capas)' },
  { value: 'circle', label: 'Círculo' },
  { value: 'ring', label: 'Anillo' },
  { value: 'sine', label: 'Onda sinusoidal' },
  { value: 'world', label: 'Mapa mundi' },
  { value: 'grid', label: 'Retícula' },
  { value: 'spiral', label: 'Espiral' },
]

const COLOR_PRESETS = ['#0a0a0a', '#f0ead6', '#e8ff6b', '#ff8fb1']

// ───────── Capas montañas (mismas que el DotMountains original) ─────────
const MOUNTAIN_LAYERS = [
  { amp: 70, freq: 0.0038, phase: 0.0, speed: 0.18, base: 0.5, density: 0.55 },
  { amp: 110, freq: 0.0029, phase: 1.3, speed: 0.24, base: 0.62, density: 0.8 },
  { amp: 150, freq: 0.0022, phase: 2.8, speed: 0.16, base: 0.78, density: 1.0 },
]

// Hash determinista por celda — usado para enmascarar puntos y dar la
// estética de partículas dispersas en vez de relleno sólido.
function hash(i: number, j: number): number {
  let h = (i * 374761393) ^ (j * 668265263)
  h = (h ^ (h >>> 13)) >>> 0
  h = (h * 1274126177) >>> 0
  return (h % 100000) / 100000
}

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

// ───────── Simplex 3D inline ─────────
// Implementación compacta basada en el algoritmo de Stefan Gustavson.
// Devuelve valores aprox. en [-1, 1]. Tabla de permutación generada
// con un PRNG simple para que el ruido no cambie entre recargas.
const GRAD3 = new Int8Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1,
  1, 0, 1, -1, 0, -1, -1,
])

function buildPerm(seed = 1337) {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  let s = seed | 0 || 1
  for (let i = 255; i > 0; i--) {
    s = (s * 1103515245 + 12345) | 0
    const j = ((s >>> 16) & 0x7fff) % (i + 1)
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  const perm = new Uint8Array(512)
  const permMod12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    permMod12[i] = perm[i] % 12
  }
  return { perm, permMod12 }
}

function makeNoise3(seed = 1337) {
  const { perm, permMod12 } = buildPerm(seed)
  const F3 = 1 / 3
  const G3 = 1 / 6
  return function noise3(x: number, y: number, z: number) {
    const s = (x + y + z) * F3
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const k = Math.floor(z + s)
    const t = (i + j + k) * G3
    const X0 = i - t
    const Y0 = j - t
    const Z0 = k - t
    const x0 = x - X0
    const y0 = y - Y0
    const z0 = z - Z0
    let i1, j1, k1, i2, j2, k2
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0
      } else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1
      } else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1
      }
    } else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1
      } else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1
      } else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0
      }
    }
    const x1 = x0 - i1 + G3
    const y1 = y0 - j1 + G3
    const z1 = z0 - k1 + G3
    const x2 = x0 - i2 + 2 * G3
    const y2 = y0 - j2 + 2 * G3
    const z2 = z0 - k2 + 2 * G3
    const x3 = x0 - 1 + 3 * G3
    const y3 = y0 - 1 + 3 * G3
    const z3 = z0 - 1 + 3 * G3
    const ii = i & 255
    const jj = j & 255
    const kk = k & 255
    const gi0 = permMod12[ii + perm[jj + perm[kk]]] * 3
    const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3
    const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3
    const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0
    if (t0 >= 0) {
      t0 *= t0
      n0 = t0 * t0 * (GRAD3[gi0] * x0 + GRAD3[gi0 + 1] * y0 + GRAD3[gi0 + 2] * z0)
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1
    if (t1 >= 0) {
      t1 *= t1
      n1 = t1 * t1 * (GRAD3[gi1] * x1 + GRAD3[gi1 + 1] * y1 + GRAD3[gi1 + 2] * z1)
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2
    if (t2 >= 0) {
      t2 *= t2
      n2 = t2 * t2 * (GRAD3[gi2] * x2 + GRAD3[gi2 + 1] * y2 + GRAD3[gi2 + 2] * z2)
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3
    if (t3 >= 0) {
      t3 *= t3
      n3 = t3 * t3 * (GRAD3[gi3] * x3 + GRAD3[gi3 + 1] * y3 + GRAD3[gi3 + 2] * z3)
    }
    return 32 * (n0 + n1 + n2 + n3)
  }
}

// ───────── Bake del mapa de luminancia ─────────
// Pinta texto / forma / imagen en un canvas oculto y devuelve el ImageData.
// Para "mountains" no se hace bake: la densidad se calcula por celda en el
// loop porque las capas se animan en el tiempo.

function bakeText(ctx: CanvasRenderingContext2D, w: number, h: number, text: string, fontFam: string) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let size = Math.min((w / Math.max(text.length, 4)) * 1.6, h * 0.7)
  ctx.font = `700 ${size}px ${fontFam}`
  let m = ctx.measureText(text)
  while (m.width > w * 0.92 && size > 12) {
    size -= 4
    ctx.font = `700 ${size}px ${fontFam}`
    m = ctx.measureText(text)
  }
  ctx.fillText(text, w / 2, h / 2)
}

function bakeShape(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shape: Shape,
  simplex: (x: number, y: number, z: number) => number,
) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'

  const cx = w / 2
  const cy = h / 2
  const r = Math.min(w, h) * 0.32

  switch (shape) {
    case 'circle': {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'ring': {
      ctx.lineWidth = Math.max(8, r * 0.18)
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'sine': {
      const amp = h * 0.18
      const freq = (Math.PI * 4) / w
      ctx.lineWidth = Math.max(8, h * 0.04)
      ctx.beginPath()
      for (let x = 0; x <= w; x += 2) {
        const y = cy + Math.sin(x * freq) * amp
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    }
    case 'grid': {
      ctx.lineWidth = 2
      const step = Math.max(24, Math.min(w, h) / 14)
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      break
    }
    case 'spiral': {
      ctx.lineWidth = Math.max(3, Math.min(w, h) / 220)
      ctx.beginPath()
      const turns = 8
      const maxR = Math.min(w, h) * 0.45
      for (let a = 0; a < turns * Math.PI * 2; a += 0.05) {
        const rr = (a / (turns * Math.PI * 2)) * maxR
        const x = cx + Math.cos(a) * rr
        const y = cy + Math.sin(a) * rr
        if (a === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      break
    }
    case 'world': {
      // Mapa mundi placeholder: simplex con threshold + atenuación por
      // latitud (suaviza polos) genera "continentes" creíbles sin assets.
      const img = ctx.getImageData(0, 0, w, h)
      const data = img.data
      for (let y = 0; y < h; y++) {
        const ny = (y - cy) / cy
        const latMask = Math.max(0, 1 - Math.abs(ny) * 1.05)
        for (let x = 0; x < w; x++) {
          const nx = (x - cx) / cx
          const u = nx * 4
          const v = ny * 2
          let n = simplex(u, v, 0) * 0.6 + simplex(u * 2.1, v * 2.1, 1.3) * 0.3 + simplex(u * 4.2, v * 4.2, 2.7) * 0.1
          n = (n + 1) * 0.5
          const land = n * latMask > 0.42 ? 255 : 0
          const idx = (y * w + x) * 4
          data[idx] = land
          data[idx + 1] = land
          data[idx + 2] = land
          data[idx + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
      break
    }
    case 'mountains': {
      // No-op aquí — el render de montañas se hace inline en el frame
      // porque las capas se animan con el tiempo. Mantenemos el offscreen
      // limpio para que sample devuelva 0 si por error se entra a esta rama.
      break
    }
  }
}

function bakeImage(ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  const ar = img.width / img.height
  const cr = w / h
  let dw = w
  let dh = h
  if (ar > cr) {
    dw = w
    dh = w / ar
  } else {
    dh = h
    dw = h * ar
  }
  const dx = (w - dw) / 2
  const dy = (h - dh) / 2
  ctx.drawImage(img, dx, dy, dw, dh)
  // pasar a escala de grises
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0
    d[i] = g
    d[i + 1] = g
    d[i + 2] = g
  }
  ctx.putImageData(id, 0, 0)
}

// ───────── Componente ─────────

type Props = { className?: string }

export default function HeroDotMatrix({ className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const showPanel = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('fx') === '1'
  }, [])

  const [config, setConfig] = useState<Config>(() => loadConfig())
  const cfgRef = useRef<Config>(config)
  const imgElRef = useRef<HTMLImageElement | null>(null)
  const lumDirtyRef = useRef(0)

  useEffect(() => {
    cfgRef.current = config
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      // sin espacio o privado
    }
  }, [config])

  useEffect(() => {
    if (config.mode !== 'image' || !config.imageUrl) {
      imgElRef.current = null
      lumDirtyRef.current++
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgElRef.current = img
      lumDirtyRef.current++
    }
    img.onerror = () => {
      imgElRef.current = null
      lumDirtyRef.current++
    }
    img.src = config.imageUrl
  }, [config.imageUrl, config.mode])

  useEffect(() => {
    if (!showPanel && config.mode !== 'text') return
    if (document.getElementById('pp-fx-fonts')) return
    const l = document.createElement('link')
    l.id = 'pp-fx-fonts'
    l.rel = 'stylesheet'
    l.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Instrument+Serif&family=Fraunces:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Space+Grotesk:wght@400;700&display=swap'
    document.head.appendChild(l)
  }, [showPanel, config.mode])

  useEffect(() => {
    lumDirtyRef.current++
  }, [config.mode, config.text, config.textFont, config.shape])

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    document.fonts.ready.then(() => {
      lumDirtyRef.current++
    })
  }, [])

  // ───────── Animation effect ─────────
  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const off = document.createElement('canvas')
    const offCtx = off.getContext('2d', { willReadFrequently: true })!
    const simplex = makeNoise3(1337)

    let width = 0
    let height = 0
    let lumData: Uint8ClampedArray | null = null
    let lumW = 0
    let lumH = 0
    let lastDirty = -1

    let mouseX = -9999
    let mouseY = -9999
    let targetMX = -9999
    let targetMY = -9999

    let waveStart = -Infinity
    let rafId = 0
    let lastFrame = 0

    // Buffers reusables — evita asignaciones por frame.
    let mtnHeightBuf: Float32Array | null = null
    let hashBuf: Float32Array | null = null
    let bufCols = 0
    let bufRows = 0

    function resize() {
      const r = wrap.getBoundingClientRect()
      width = Math.max(320, Math.floor(r.width))
      height = Math.max(120, Math.floor(r.height))
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      lastDirty = -1
      bufCols = 0
      bufRows = 0
    }

    function rebakeIfNeeded() {
      const cfg = cfgRef.current
      // Para "mountains" la densidad se computa inline cada frame.
      if (cfg.mode === 'shape' && cfg.shape === 'mountains') return
      if (lastDirty === lumDirtyRef.current && lumW === width && lumH === height) return
      lumW = width
      lumH = height
      off.width = width
      off.height = height
      if (cfg.mode === 'text') {
        bakeText(offCtx, width, height, cfg.text || ' ', `'${cfg.textFont}', sans-serif`)
      } else if (cfg.mode === 'shape') {
        bakeShape(offCtx, width, height, cfg.shape, simplex)
      } else if (cfg.mode === 'image') {
        if (imgElRef.current) bakeImage(offCtx, width, height, imgElRef.current)
        else {
          offCtx.fillStyle = '#000'
          offCtx.fillRect(0, 0, width, height)
        }
      }
      lumData = offCtx.getImageData(0, 0, width, height).data
      lastDirty = lumDirtyRef.current
    }

    function readThemeColors() {
      const root = getComputedStyle(document.documentElement)
      const fg = root.getPropertyValue('--fg').trim() || '10 10 10'
      const bg = root.getPropertyValue('--bg').trim() || '240 234 214'
      const fgParts = fg.split(/\s+|,/).map((n) => parseInt(n, 10) || 0)
      const bgParts = bg.split(/\s+|,/).map((n) => parseInt(n, 10) || 0)
      return {
        fg: `rgb(${fgParts.join(',')})`,
        bg: `rgb(${bgParts.join(',')})`,
        fgRgb: fgParts,
      }
    }
    // Cachea los colores del tema y solo los actualiza cuando cambia
    // `data-theme` en <html>. Evita un getComputedStyle por frame.
    let themeCache = readThemeColors()
    const themeObserver = new MutationObserver(() => {
      themeCache = readThemeColors()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    function onMove(e: MouseEvent) {
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
      const cfg = cfgRef.current
      // Cap a ~30fps en todos los dispositivos: el ruido es lento y no se
      // nota la diferencia con 60fps, libera ~50% CPU durante scroll.
      const minDelta = 33
      if (now - lastFrame < minDelta) {
        rafId = requestAnimationFrame(draw)
        return
      }
      lastFrame = now

      rebakeIfNeeded()

      const t = now / 1000
      const isMountains = cfg.mode === 'shape' && cfg.shape === 'mountains'

      // Onda horizontal: cada `waveSeconds` se relanza una banda gaussiana
      // que cruza el canvas en 4s, atenuada con sigma=0.12 (más ancha y
      // suave que el ajuste original). Easing in-out para evitar entrada
      // y salida bruscas.
      if (now - waveStart > cfg.waveSeconds * 1000) {
        waveStart = now
      }
      const waveElapsed = (now - waveStart) / 1000
      const waveDur = 4
      const waveActive = waveElapsed >= 0 && waveElapsed <= waveDur
      // ease in-out: arranca lento, cruza, sale lento.
      const waveLin = waveActive ? waveElapsed / waveDur : 0
      const waveEase = waveLin * waveLin * (3 - 2 * waveLin)
      const wavePos = waveActive ? -0.2 + waveEase * 1.4 : 999
      const waveSigma = 0.12
      // Envelope: atenúa el pico al inicio y final del barrido para que
      // el glow aparezca y desaparezca de forma orgánica.
      const waveEnvelope = waveActive ? Math.sin(waveLin * Math.PI) : 0

      mouseX += (targetMX - mouseX) * 0.18
      mouseY += (targetMY - mouseY) * 0.18

      const theme = themeCache
      const dotCol = cfg.useThemeColors ? theme.fg : cfg.dotColor
      const bgCol = cfg.useThemeColors ? theme.bg : cfg.bgColor

      ctx.fillStyle = bgCol
      ctx.fillRect(0, 0, width, height)

      // Resolver dot color a tupla RGB
      let dotR = 10, dotG = 10, dotB = 10
      if (cfg.useThemeColors) {
        dotR = theme.fgRgb[0] ?? 10
        dotG = theme.fgRgb[1] ?? 10
        dotB = theme.fgRgb[2] ?? 10
      } else {
        const m = /^#?([0-9a-f]{6})$/i.exec(dotCol)
        if (m) {
          const hex = m[1]
          dotR = parseInt(hex.slice(0, 2), 16)
          dotG = parseInt(hex.slice(2, 4), 16)
          dotB = parseInt(hex.slice(4, 6), 16)
        }
      }

      const cell = Math.max(2, cfg.cell)
      const cols = Math.ceil(width / cell) + 1
      const rows = Math.ceil(height / cell) + 1
      const mouseR = 180
      const mouseR2 = mouseR * mouseR
      const noiseT = t * cfg.noiseSpeed * 0.5
      const amp = reduced ? 0 : cfg.amplitude
      const lum = lumData

      // Pre-cálculo de alturas de capa por columna (solo modo mountains).
      // Reusa Float32Array para evitar GC churn: layout [col0_l0, col0_l1,
      // col0_l2, col1_l0, ...].
      const NLAYERS = MOUNTAIN_LAYERS.length
      if (isMountains) {
        if (!mtnHeightBuf || bufCols !== cols) {
          mtnHeightBuf = new Float32Array(cols * NLAYERS)
          bufCols = cols
        }
        const mh = mtnHeightBuf
        for (let i = 0; i < cols; i++) {
          const x = i * cell
          for (let li = 0; li < NLAYERS; li++) {
            const l = MOUNTAIN_LAYERS[li]
            const a = Math.sin(x * l.freq + l.phase + t * l.speed)
            const b = Math.sin(x * l.freq * 1.7 + l.phase * 0.5 + t * l.speed * 0.6)
            const wave = (a + 0.5 * b) / 1.5
            mh[i * NLAYERS + li] = height * l.base - l.amp * wave
          }
        }
        // Tabla hash precomputada por celda — evita recalcular el hash
        // en cada frame durante la vida de este resize.
        if (!hashBuf || bufCols !== cols || bufRows !== rows) {
          hashBuf = new Float32Array(cols * rows)
          for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
              hashBuf[j * cols + i] = hash(i, j)
            }
          }
          bufRows = rows
        }
      }

      const TWO_PI = Math.PI * 2

      for (let j = 0; j < rows; j++) {
        const cy = j * cell + cell / 2
        for (let i = 0; i < cols; i++) {
          const cx = i * cell + cell / 2

          // Determina luminancia / densidad por celda según modo.
          let l = 0
          if (isMountains) {
            // Densidad = suma ponderada de capas cuya silueta queda por
            // encima de cy. Cada capa aporta más conforme el punto está
            // más adentro de la "ladera".
            const base = i * NLAYERS
            const mh = mtnHeightBuf!
            let density = 0
            for (let li = 0; li < NLAYERS; li++) {
              const sh = mh[base + li]
              if (cy > sh) {
                const into = Math.min(1, (cy - sh) / 220)
                density += MOUNTAIN_LAYERS[li].density * (0.25 + 0.75 * into)
              }
            }
            if (density < 0.04) continue
            density = Math.min(1, density)
            // Máscara hash dispersa los puntos para no rellenar sólido.
            const r = hashBuf![j * cols + i]
            if (r > density + 0.18) continue
            l = density
          } else {
            const px = Math.min(width - 1, Math.max(0, cx | 0))
            const py = Math.min(height - 1, Math.max(0, cy | 0))
            const idx = (py * width + px) * 4
            l = lum ? lum[idx] / 255 : 0
            if (cfg.invertLuminance) l = 1 - l
            if (l < 0.05) continue
          }

          // Ruido orgánico: dx/dy y modulación de radio.
          // 0.01 controla la longitud de onda espacial; valores menores
          // = ondas más grandes y suaves.
          const ny = simplex(cx * 0.01, cy * 0.01, noiseT)
          const nx = simplex(cx * 0.01 + 100, cy * 0.01 + 100, noiseT)
          let dx = nx * amp
          let dy = ny * amp

          // Radio = base * luminancia * (0.7 + 0.3 * ruido_normalizado)
          // Piso de 70% para evitar parpadeo brusco entre frames.
          let radius = cfg.baseRadius * l * (0.7 + 0.3 * (ny * 0.5 + 0.5))

          // Mouse: empuja radialmente y agranda.
          if (mouseX > -9000) {
            const ddx = cx - mouseX
            const ddy = cy - mouseY
            const md2 = ddx * ddx + ddy * ddy
            if (md2 < mouseR2) {
              const md = Math.sqrt(md2) || 0.0001
              const inf = 1 - md / mouseR
              radius *= 1 + inf * 1.4
              dx += (ddx / md) * inf * 5
              dy += (ddy / md) * inf * 5
            }
          }

          // Banda gaussiana horizontal (onda). Boost reducido a 0.3 y
          // multiplicado por envelope sin para entrada/salida suaves.
          if (waveActive) {
            const d = cx / width - wavePos
            const boost = Math.exp(-(d * d) / (2 * waveSigma * waveSigma))
            radius *= 1 + boost * waveEnvelope * 0.3
          }

          if (radius < 0.25) continue

          ctx.beginPath()
          ctx.fillStyle = `rgba(${dotR},${dotG},${dotB},${(0.45 + l * 0.5).toFixed(3)})`
          ctx.arc(cx + dx, cy + dy, radius, 0, TWO_PI)
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
      themeObserver.disconnect()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  // ───────── Handlers panel ─────────
  const update = <K extends keyof Config>(k: K, v: Config[K]) => setConfig((c) => ({ ...c, [k]: v }))
  const onFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setConfig((c) => ({ ...c, mode: 'image', imageUrl: reader.result as string }))
      }
    }
    reader.readAsDataURL(file)
  }
  const reset = () => setConfig({ ...DEFAULTS })

  return (
    <>
      <div
        ref={wrapRef}
        className={className}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}
        aria-hidden
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>

      {showPanel && (
        <ControlPanel
          config={config}
          update={update}
          onFile={onFile}
          reset={reset}
        />
      )}
    </>
  )
}

// ───────── Control Panel ─────────

type PanelProps = {
  config: Config
  update: <K extends keyof Config>(k: K, v: Config[K]) => void
  onFile: (f: File | null) => void
  reset: () => void
}

function ControlPanel({ config, update, onFile, reset }: PanelProps) {
  const [open, setOpen] = useState(false)

  const row = 'flex items-center justify-between gap-2'
  const label = 'opacity-70 shrink-0'
  const input =
    'bg-transparent border border-current/20 rounded px-2 py-1 text-[11px] outline-none focus:border-current/60 w-full'

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] font-mono text-[11px]"
      style={{ pointerEvents: 'auto' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-auto block h-9 w-9 rounded-md text-[11px] font-bold tracking-wider"
        style={{ background: 'rgb(var(--fg))', color: 'rgb(var(--bg))' }}
      >
        FX
      </button>
      {open && (
        <div
          className="mt-2 w-[280px] max-h-[78vh] overflow-y-auto rounded-md p-3 space-y-2 backdrop-blur"
          style={{
            background: 'rgb(var(--bg) / 0.92)',
            border: '1px solid rgb(var(--fg) / 0.18)',
            color: 'rgb(var(--fg))',
          }}
        >
          <div className={row}>
            <span className={label}>Modo</span>
            <div className="flex gap-1">
              {(['text', 'image', 'shape'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update('mode', m)}
                  className="px-2 py-1 rounded border text-[10px] uppercase tracking-wider"
                  style={{
                    borderColor: 'rgb(var(--fg) / 0.25)',
                    background: config.mode === m ? 'rgb(var(--fg))' : 'transparent',
                    color: config.mode === m ? 'rgb(var(--bg))' : 'inherit',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {config.mode === 'text' && (
            <>
              <div className={row}>
                <span className={label}>Texto</span>
                <input
                  className={input}
                  value={config.text}
                  onChange={(e) => update('text', e.target.value)}
                />
              </div>
              <div className={row}>
                <span className={label}>Fuente</span>
                <select
                  className={input}
                  value={config.textFont}
                  onChange={(e) => update('textFont', e.target.value)}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {config.mode === 'shape' && (
            <div className={row}>
              <span className={label}>Forma</span>
              <select
                className={input}
                value={config.shape}
                onChange={(e) => update('shape', e.target.value as Shape)}
              >
                {SHAPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {config.mode === 'image' && (
            <>
              <div className={row}>
                <span className={label}>URL</span>
                <input
                  className={input}
                  placeholder="https://…/img.png"
                  value={config.imageUrl.startsWith('data:') ? '' : config.imageUrl}
                  onChange={(e) => update('imageUrl', e.target.value)}
                />
              </div>
              <div className={row}>
                <span className={label}>Archivo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="text-[10px] w-full"
                  onChange={(e) => onFile(e.target.files?.[0] || null)}
                />
              </div>
            </>
          )}

          <Slider label="Radio base" min={0.5} max={5} step={0.1} value={config.baseRadius} onChange={(v) => update('baseRadius', v)} />
          <Slider label="Espaciado" min={4} max={16} step={1} value={config.cell} onChange={(v) => update('cell', v)} />
          <Slider label="Velocidad" min={0} max={2} step={0.05} value={config.noiseSpeed} onChange={(v) => update('noiseSpeed', v)} />
          <Slider label="Amplitud" min={0} max={10} step={0.1} value={config.amplitude} onChange={(v) => update('amplitude', v)} />
          <Slider label="Onda (s)" min={2} max={15} step={0.5} value={config.waveSeconds} onChange={(v) => update('waveSeconds', v)} />

          <div className={row}>
            <span className={label}>Tema auto</span>
            <input
              type="checkbox"
              checked={config.useThemeColors}
              onChange={(e) => update('useThemeColors', e.target.checked)}
            />
          </div>

          <ColorRow
            label="Punto"
            value={config.dotColor}
            onChange={(v) => update('dotColor', v)}
            disabled={config.useThemeColors}
          />
          <ColorRow
            label="Fondo"
            value={config.bgColor}
            onChange={(v) => update('bgColor', v)}
            disabled={config.useThemeColors}
          />

          <div className={row}>
            <span className={label}>Invertir lum.</span>
            <input
              type="checkbox"
              checked={config.invertLuminance}
              onChange={(e) => update('invertLuminance', e.target.checked)}
            />
          </div>

          <button
            type="button"
            onClick={reset}
            className="mt-2 w-full py-1.5 rounded text-[10px] uppercase tracking-wider"
            style={{ border: '1px solid rgb(var(--fg) / 0.3)' }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="opacity-70 w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="tabular-nums w-10 text-right opacity-70">{value.toFixed(2)}</span>
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2" style={{ opacity: disabled ? 0.4 : 1 }}>
      <span className="opacity-70 w-20 shrink-0">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-6 w-8 rounded border border-current/20 bg-transparent"
      />
      <div className="flex gap-1">
        {COLOR_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p)}
            className="h-5 w-5 rounded border border-current/20"
            style={{ background: p }}
            aria-label={p}
          />
        ))}
      </div>
    </div>
  )
}
