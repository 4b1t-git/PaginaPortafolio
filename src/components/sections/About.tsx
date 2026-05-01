import { useReveal } from '@/hooks/useReveal'

const facts = [
  { k: 'Rol', v: 'Frontend Developer & Diseñador' },
  { k: 'Ubicación', v: 'Chile · Remoto' },
  { k: 'Foco', v: 'Web apps · Landings · UI animada' },
  { k: 'Trabajo', v: 'Disponible para proyectos' },
]

export default function About() {
  const ref = useReveal<HTMLElement>()

  return (
    <section
      ref={ref}
      id="sobre-mi"
      className="relative py-24 md:py-32 px-6 border-t border-current/10"
    >
      <div className="mx-auto max-w-7xl grid md:grid-cols-12 gap-12 md:gap-16">
        <div className="md:col-span-5" data-reveal>
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-60">
            ⌗ 02 — Sobre mí
          </span>
          <h2 className="mt-3 font-display text-3xl md:text-5xl uppercase tracking-wider">
            Diseño y código,
            <br />
            del concepto al deploy.
          </h2>
        </div>

        <div className="md:col-span-7 space-y-8">
          <p className="font-mono text-base md:text-lg leading-relaxed opacity-80" data-reveal data-reveal-delay="0.1">
            Trabajo con marcas y emprendedores construyendo interfaces que se
            sienten vivas: micro-animaciones, jerarquía clara y rendimiento
            cuidado. Cada proyecto se piensa desde el resultado del cliente,
            no desde la tendencia del mes.
          </p>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {facts.map((f, i) => (
              <div
                key={f.k}
                className="rounded-2xl border border-current/15 p-5"
                data-reveal
                data-reveal-delay={(0.15 + i * 0.05).toString()}
              >
                <dt className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-50">
                  {f.k}
                </dt>
                <dd className="mt-2 font-mono text-sm">{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
