import { useMemo, useState } from 'react'
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
                data-cursor="hover"
                className={`font-mono text-[11px] uppercase tracking-[0.2em] px-3.5 py-2 rounded-full border transition-colors ${
                  active === t
                    ? 'bg-current text-[var(--color-bg)] border-current'
                    : 'border-current/20 hover:border-current/60'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {visible.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
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
