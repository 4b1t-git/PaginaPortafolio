import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { projects, filterTags, type FilterTag } from '@/data/projects'
import ProjectCard from '@/components/gallery/ProjectCard'

export default function Gallery() {
  const [active, setActive] = useState<FilterTag>('todos')

  const visible = useMemo(() => {
    if (active === 'todos') return projects
    return projects.filter((p) => p.tags.includes(active as Exclude<FilterTag, 'todos'>))
  }, [active])

  return (
    <section
      id="proyectos"
      className="relative py-24 md:py-32 px-6 border-t border-current/10"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-12 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-60">
              ⌗ 01 — Proyectos
            </span>
            <h2 className="mt-3 font-display text-3xl md:text-5xl uppercase tracking-wider">
              Trabajo seleccionado
            </h2>
            <p className="mt-4 max-w-xl font-mono text-sm opacity-70">
              Galería de proyectos. Pronto se irán sumando los enlaces a las páginas
              entregadas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filterTags.map((t) => (
              <button
                key={t}
                onClick={() => setActive(t)}
                aria-pressed={active === t}
                data-cursor="hover"
                className={`relative isolate overflow-hidden font-mono text-[11px] uppercase tracking-[0.2em] px-3.5 py-2 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${
                  active === t
                    ? 'border-current'
                    : 'border-current/20 hover:border-current/60'
                }`}
              >
                {active === t && (
                  <m.span
                    layoutId="active-project-filter"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-[rgb(var(--fg))]"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span
                  className={`relative z-10 transition-colors ${
                    active === t ? 'text-[rgb(var(--bg))]' : ''
                  }`}
                >
                  {t}
                </span>
              </button>
            ))}
          </div>
        </header>

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((p) => (
              <m.div
                key={p.id}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  layout: { type: 'spring', stiffness: 320, damping: 32 },
                  opacity: { duration: 0.18 },
                }}
              >
                <ProjectCard project={p} />
              </m.div>
            ))}
          </AnimatePresence>
        </div>

        {visible.length === 0 && (
          <p className="text-center font-mono opacity-50 py-16">
            Sin proyectos en esta categoría aún.
          </p>
        )}
      </div>
    </section>
  )
}
