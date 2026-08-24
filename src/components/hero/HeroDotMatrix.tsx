import { useEffect, useMemo, useRef, useState } from 'react'
import { createProgram, SNOISE_GLSL } from '@/lib/webgl'

// Halftone procedural en WebGL2. Sustituye al fondo de montañas del hero.
// Modos: text / image / shape. Onda horizontal gaussiana periódica.
// Toda la animación por punto (montañas, ruido, mouse, onda) corre en el
// vertex shader: el main thread solo sube uniforms. Default: shape =
// "mountains" — 2 capas senoidales animadas.

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
  { value: 'mountains', label: 'Montañas (2 capas)' },
  { value: 'circle', label: 'Círculo' },
  { value: 'ring', label: 'Anillo' },
  { value: 'sine', label: 'Onda sinusoidal' },
  { value: 'world', label: 'Mapa mundi' },
  { value: 'grid', label: 'Retícula' },
  { value: 'spiral', label: 'Espiral' },
]

const COLOR_PRESETS = ['#0a0a0a', '#f0ead6', '#e8ff6b', '#ff8fb1']

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

// ───────── Simplex 3D inline (solo para el bake de "world") ─────────
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
// Pinta texto / forma / imagen en un canvas oculto que luego se sube como
// textura. Para "mountains" no se hace bake: la densidad se calcula en el
// vertex shader porque las capas se animan en el tiempo.

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
      // No-op — el render de montañas se hace en el vertex shader.
      break
    }
  }
}

function bakeImage(ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  const ar = img.width / img.height
  const cr = w / h
  let dw: number
  let dh: number
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

// ───────── Shaders ─────────

const VERT = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_cell;   // índice de celda (i, j)
in float a_hash;  // hash determinista 0..1

uniform vec2 u_res;        // tamaño en px CSS
uniform float u_cell;
uniform float u_dpr;
uniform float u_time;      // segundos
uniform float u_amp;
uniform float u_baseRadius;
uniform float u_noiseSpeed;
uniform int u_mode;        // 0 = montañas, 1 = textura de luminancia
uniform sampler2D u_lum;
uniform int u_invert;
uniform float u_wavePos;   // >900 si la onda está inactiva
uniform float u_waveEnv;

out float v_alpha;

${SNOISE_GLSL}

// Una capa de montaña: silueta senoidal animada.
float layerHeight(float cx, float t, float amp, float freq, float phase, float speed, float base) {
  float a = sin(cx * freq + phase + t * speed);
  float b = sin(cx * freq * 1.7 + phase * 0.5 + t * speed * 0.6);
  float w = (a + 0.5 * b) / 1.5;
  return u_res.y * base - amp * w;
}

void main() {
  float cell = u_cell;
  float cx = a_cell.x * cell + cell * 0.5;
  float cy = a_cell.y * cell + cell * 0.5;

  float l = 0.0;
  if (u_mode == 0) {
    float density = 0.0;
    float sh0 = layerHeight(cx, u_time, 110.0, 0.0029, 1.3, 0.24, 0.62);
    if (cy > sh0) { float into = min(1.0, (cy - sh0) / 220.0); density += 0.8 * (0.25 + 0.75 * into); }
    float sh1 = layerHeight(cx, u_time, 150.0, 0.0022, 2.8, 0.16, 0.78);
    if (cy > sh1) { float into = min(1.0, (cy - sh1) / 220.0); density += 1.0 * (0.25 + 0.75 * into); }
    density = min(1.0, density);
    if (density < 0.04 || a_hash > density + 0.18) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      v_alpha = 0.0;
      return;
    }
    l = density;
  } else {
    l = texture(u_lum, vec2(cx / u_res.x, cy / u_res.y)).r;
    if (u_invert == 1) l = 1.0 - l;
    if (l < 0.05) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      v_alpha = 0.0;
      return;
    }
  }

  float noiseT = u_time * u_noiseSpeed * 0.5;
  float ny = snoise(vec3(cx * 0.01, cy * 0.01, noiseT));
  float nx = snoise(vec3(cx * 0.01 + 100.0, cy * 0.01 + 100.0, noiseT));
  float dx = nx * u_amp;
  float dy = ny * u_amp;

  float radius = u_baseRadius * l * (0.7 + 0.3 * (ny * 0.5 + 0.5));

  if (u_wavePos < 900.0) {
    float d = cx / u_res.x - u_wavePos;
    float sigma = 0.12;
    float boost = exp(-(d * d) / (2.0 * sigma * sigma));
    radius *= 1.0 + boost * u_waveEnv * 0.3;
  }

  if (radius < 0.25) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    v_alpha = 0.0;
    return;
  }

  float px = cx + dx;
  float py = cy + dy;
  vec2 ndc = vec2((px / u_res.x) * 2.0 - 1.0, 1.0 - (py / u_res.y) * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = radius * 2.0 * u_dpr;
  v_alpha = 0.45 + l * 0.5;
}
`

const FRAG = /* glsl */ `#version 300 es
precision highp float;

in float v_alpha;
uniform vec3 u_color;
out vec4 outColor;

void main() {
  if (v_alpha <= 0.0) discard;
  vec2 pc = gl_PointCoord - 0.5;
  float d = length(pc);
  if (d > 0.5) discard;
  float aa = smoothstep(0.5, 0.42, d);
  outColor = vec4(u_color, v_alpha * aa);
}
`

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

  // ───────── Animation effect (WebGL2) ─────────
  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    })
    if (!gl) return // sin WebGL2 el hero queda con el color de fondo

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const off = document.createElement('canvas')
    const offCtx = off.getContext('2d', { willReadFrequently: true })!
    const simplex = makeNoise3(1337)

    const program = createProgram(gl, VERT, FRAG)
    const loc = {
      a_cell: gl.getAttribLocation(program, 'a_cell'),
      a_hash: gl.getAttribLocation(program, 'a_hash'),
      u_res: gl.getUniformLocation(program, 'u_res'),
      u_cell: gl.getUniformLocation(program, 'u_cell'),
      u_dpr: gl.getUniformLocation(program, 'u_dpr'),
      u_time: gl.getUniformLocation(program, 'u_time'),
      u_amp: gl.getUniformLocation(program, 'u_amp'),
      u_baseRadius: gl.getUniformLocation(program, 'u_baseRadius'),
      u_noiseSpeed: gl.getUniformLocation(program, 'u_noiseSpeed'),
      u_mode: gl.getUniformLocation(program, 'u_mode'),
      u_lum: gl.getUniformLocation(program, 'u_lum'),
      u_invert: gl.getUniformLocation(program, 'u_invert'),
      u_wavePos: gl.getUniformLocation(program, 'u_wavePos'),
      u_waveEnv: gl.getUniformLocation(program, 'u_waveEnv'),
      u_color: gl.getUniformLocation(program, 'u_color'),
    }

    const vao = gl.createVertexArray()!
    const cellBuf = gl.createBuffer()!
    const hashBuf = gl.createBuffer()!
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, cellBuf)
    gl.enableVertexAttribArray(loc.a_cell)
    gl.vertexAttribPointer(loc.a_cell, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, hashBuf)
    gl.enableVertexAttribArray(loc.a_hash)
    gl.vertexAttribPointer(loc.a_hash, 1, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    const lumTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, lumTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let count = 0
    let geomCell = 0
    let lumW = 0
    let lumH = 0
    let lastDirty = -1

    let waveStart = -Infinity
    let rafId = 0
    let lastFrame = 0
    // Pausa el render cuando el hero sale del viewport.
    let visible = true
    let geomMtn = false

    function buildGeometry() {
      const cfg = cfgRef.current
      const cell = Math.max(2, cfg.cell)
      const isMtn = cfg.mode === 'shape' && cfg.shape === 'mountains'
      cols = Math.ceil(width / cell) + 1
      rows = Math.ceil(height / cell) + 1
      geomCell = cell
      geomMtn = isMtn
      // En modo montañas las filas superiores nunca encienden: la silueta
      // más alta (capa 0) queda sobre height*0.62 - 110. Saltarlas evita
      // ejecutar el vertex shader para puntos que siempre se descartan.
      let startRow = 0
      if (isMtn) {
        const topLit = height * 0.62 - 110 - (cell * 2 + 16)
        startRow = Math.max(0, Math.floor(topLit / cell))
      }
      count = cols * (rows - startRow)
      const cells = new Float32Array(count * 2)
      const hashes = new Float32Array(count)
      let k = 0
      for (let j = startRow; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          cells[k * 2] = i
          cells[k * 2 + 1] = j
          hashes[k] = hash(i, j)
          k++
        }
      }
      gl!.bindBuffer(gl!.ARRAY_BUFFER, cellBuf)
      gl!.bufferData(gl!.ARRAY_BUFFER, cells, gl!.DYNAMIC_DRAW)
      gl!.bindBuffer(gl!.ARRAY_BUFFER, hashBuf)
      gl!.bufferData(gl!.ARRAY_BUFFER, hashes, gl!.DYNAMIC_DRAW)
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
      buildGeometry()
      lastDirty = -1
    }

    function rebakeIfNeeded() {
      const cfg = cfgRef.current
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
      gl!.bindTexture(gl!.TEXTURE_2D, lumTex)
      gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, off)
      lastDirty = lumDirtyRef.current
    }

    // Colores de tema cacheados — solo se releen al cambiar data-theme.
    function readTheme() {
      const root = getComputedStyle(document.documentElement)
      const parse = (s: string) => s.split(/\s+|,/).map((n) => parseInt(n, 10) || 0)
      return {
        fg: parse(root.getPropertyValue('--fg').trim() || '10 10 10'),
        bg: parse(root.getPropertyValue('--bg').trim() || '240 234 214'),
      }
    }
    function hexRgb(hex: string): number[] {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex)
      if (!m) return [10, 10, 10]
      const h = m[1]
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
    }
    let themeCache = readTheme()
    const themeObserver = new MutationObserver(() => {
      themeCache = readTheme()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    function draw(now: number) {
      if (document.hidden || !visible) {
        rafId = requestAnimationFrame(draw)
        return
      }
      // Cap a ~30fps: el ruido es lento y libera GPU/CPU durante el scroll.
      if (now - lastFrame < 33) {
        rafId = requestAnimationFrame(draw)
        return
      }
      lastFrame = now

      const cfg = cfgRef.current
      const isMountains = cfg.mode === 'shape' && cfg.shape === 'mountains'
      if (geomCell !== Math.max(2, cfg.cell) || geomMtn !== isMountains) buildGeometry()
      rebakeIfNeeded()

      const t = now / 1000

      if (now - waveStart > cfg.waveSeconds * 1000) waveStart = now
      const waveElapsed = (now - waveStart) / 1000
      const waveDur = 4
      const waveActive = waveElapsed >= 0 && waveElapsed <= waveDur
      const waveLin = waveActive ? waveElapsed / waveDur : 0
      const waveEase = waveLin * waveLin * (3 - 2 * waveLin)
      const wavePos = waveActive ? -0.2 + waveEase * 1.4 : 999
      const waveEnv = waveActive ? Math.sin(waveLin * Math.PI) : 0

      const dotRgb = cfg.useThemeColors ? themeCache.fg : hexRgb(cfg.dotColor)
      const bgRgb = cfg.useThemeColors ? themeCache.bg : hexRgb(cfg.bgColor)

      gl!.clearColor((bgRgb[0] || 0) / 255, (bgRgb[1] || 0) / 255, (bgRgb[2] || 0) / 255, 1)
      gl!.clear(gl!.COLOR_BUFFER_BIT)

      gl!.useProgram(program)
      gl!.bindVertexArray(vao)
      gl!.uniform2f(loc.u_res, width, height)
      gl!.uniform1f(loc.u_cell, geomCell)
      gl!.uniform1f(loc.u_dpr, dpr)
      gl!.uniform1f(loc.u_time, t)
      gl!.uniform1f(loc.u_amp, reduced ? 0 : cfg.amplitude)
      gl!.uniform1f(loc.u_baseRadius, cfg.baseRadius)
      gl!.uniform1f(loc.u_noiseSpeed, cfg.noiseSpeed)
      gl!.uniform1i(loc.u_mode, isMountains ? 0 : 1)
      gl!.uniform1i(loc.u_invert, cfg.invertLuminance ? 1 : 0)
      gl!.uniform1f(loc.u_wavePos, wavePos)
      gl!.uniform1f(loc.u_waveEnv, waveEnv)
      gl!.uniform3f(loc.u_color, (dotRgb[0] || 0) / 255, (dotRgb[1] || 0) / 255, (dotRgb[2] || 0) / 255)
      gl!.activeTexture(gl!.TEXTURE0)
      gl!.bindTexture(gl!.TEXTURE_2D, lumTex)
      gl!.uniform1i(loc.u_lum, 0)
      gl!.drawArrays(gl!.POINTS, 0, count)

      rafId = requestAnimationFrame(draw)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true
      },
      { threshold: 0 },
    )
    io.observe(wrap)
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
      themeObserver.disconnect()
      gl.deleteProgram(program)
      gl.deleteBuffer(cellBuf)
      gl.deleteBuffer(hashBuf)
      gl.deleteVertexArray(vao)
      gl.deleteTexture(lumTex)
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
                  aria-pressed={config.mode === m}
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
