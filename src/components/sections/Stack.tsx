import { useReveal } from '@/hooks/useReveal'

const groups = [
  {
    title: 'Lenguajes',
    items: ['TypeScript', 'JavaScript', 'HTML', 'CSS'],
  },
  {
    title: 'Frameworks',
    items: ['React', 'Next.js', 'Astro', 'Vite'],
  },
  {
    title: 'Estilos',
    items: ['Tailwind', 'CSS Modules', 'GSAP', 'Framer Motion'],
  },
  {
    title: 'Backend & infra',
    items: ['Node', 'Postgres', 'Vercel', 'GitHub Actions'],
  },
]

export default function Stack() {
  const ref = useReveal<HTMLElement>()

  return (
    <section
      ref={ref}
      id="stack"
      className="relative py-24 md:py-32 px-6 border-t border-current/10"
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-12" data-reveal>
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-60">
            ⌗ 03 — Stack
          </span>
          <h2 className="mt-3 font-display text-3xl md:text-5xl uppercase tracking-wider">
            Herramientas
          </h2>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {groups.map((g, i) => (
            <div
              key={g.title}
              data-reveal
              data-reveal-delay={(i * 0.08).toString()}
              className="rounded-3xl border border-current/15 p-6 hover:border-current/40 transition-colors"
            >
              <h3 className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-60">
                {g.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {g.items.map((it) => (
                  <li key={it} className="font-mono text-sm flex items-center gap-2">
                    <span className="inline-block h-1 w-1 rounded-full bg-current opacity-50" />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
