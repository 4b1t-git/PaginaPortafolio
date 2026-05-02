import { useEffect, useRef, useState } from 'react'
import type { Project } from '@/data/projects'

type Props = { project: Project }

function DitherOverlay({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let rafId = 0
    let w = 0
    let h = 0
    const cell = 7
    // Fases por celda — fijas durante la vida del canvas. Hacen que cada
    // punto respire en su propio compás sin parpadeo aleatorio por frame.
    let phases: Float32Array = new Float32Array(0)

    function resize() {
      const r = canvas!.parentElement!.getBoundingClientRect()
      w = Math.ceil(r.width)
      h = Math.ceil(r.height)
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width = `${w}px`
      canvas!.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const cols = Math.ceil(w / cell)
      const rows = Math.ceil(h / cell)
      phases = new Float32Array(cols * rows)
      for (let n = 0; n < phases.length; n++) phases[n] = Math.random() * Math.PI * 2
    }

    function draw(now: number) {
      const t = now / 1000
      ctx.clearRect(0, 0, w, h)
      const cols = Math.ceil(w / cell)
      const rows = Math.ceil(h / cell)
      ctx.fillStyle = '#0a0a0a'
      // Onda base lenta + pulso por celda. Velocidad ~0.6 rad/s = ciclo
      // ~10s, deliberadamente suave para casar con el hero.
      const baseW = 0.25 + 0.25 * Math.sin(t * 0.4)
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const ph = phases[i * rows + j]
          const breathe = 0.5 + 0.5 * Math.sin(t * 0.6 + ph)
          const visible = baseW + breathe * 0.55
          if (visible < 0.55) continue
          const r = 0.6 + breathe * 1.6
          ctx.beginPath()
          ctx.arc(i * cell + cell / 2, j * cell + cell / 2, r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      rafId = requestAnimationFrame(draw)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)
    if (active) rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
    }
  }, [active])

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 pointer-events-none transition-opacity duration-700 ease-out"
      style={{ opacity: active ? 0.8 : 0 }}
      aria-hidden
    />
  )
}

export default function ProjectCard({ project }: Props) {
  const [hover, setHover] = useState(false)
  const isPlaceholder = project.status === 'wip'

  const inner = (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative overflow-hidden rounded-3xl border border-current/10 bg-current/[0.03] aspect-[4/3] transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-current/30"
      data-cursor="hover"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        {project.embed ? (
          // Preview con iframe escalado: el sitio se renderiza a un ancho
          // de 250% del card y se reduce con transform al 40%, dejando un
          // viewport equivalente a desktop (~2.5x el ancho del card).
          // pointer-events:none impide interacción; el script principal
          // ya fue removido al copiar el sitio a /public.
          <iframe
            src={`${import.meta.env.BASE_URL}${project.embed}`}
            title={project.name}
            loading="lazy"
            tabIndex={-1}
            scrolling="no"
            aria-hidden
            className="border-0 origin-top-left transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[0.42]"
            style={{
              width: '250%',
              height: '250%',
              transform: 'scale(0.4)',
              pointerEvents: 'none',
            }}
          />
        ) : project.image ? (
          <img
            src={project.image}
            alt={project.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-60">
            <div className="h-14 w-14 rounded-2xl border border-current/30 grid place-items-center">
              <span className="font-display text-xl">⌗</span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em]">
              {isPlaceholder ? 'En construcción' : project.name}
            </span>
          </div>
        )}
      </div>

      <DitherOverlay active={hover} />

      <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-4 bg-gradient-to-t from-black/40 to-transparent text-white opacity-0 group-hover:opacity-100 transition-opacity duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)]">
        <div>
          <h3 className="font-display text-lg uppercase tracking-wider">
            {project.name}
          </h3>
          <p className="font-mono text-xs opacity-80 mt-1">{project.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.stack.map((s) => (
              <span
                key={s}
                className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 border border-white/20"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-[0.2em]">
        {project.status === 'wip' && (
          <span className="px-2 py-1 rounded-full bg-current/10 border border-current/20">
            WIP
          </span>
        )}
        {project.status === 'live' && (
          <span className="px-2 py-1 rounded-full bg-[var(--color-accent-lime)]/90 text-black border border-black/10">
            LIVE ↗
          </span>
        )}
      </div>
    </article>
  )

  if (project.url) {
    return (
      <a href={project.url} target="_blank" rel="noopener noreferrer" className="block">
        {inner}
      </a>
    )
  }
  return inner
}
