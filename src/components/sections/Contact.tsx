import { useReveal } from '@/hooks/useReveal'
import MagneticButton from '@/components/ui/MagneticButton'

const links = [
  { label: 'GitHub', href: 'https://github.com/4b1t-git' },
  { label: 'Email', href: 'mailto:4b1t2003@gmail.com' },
]

export default function Contact() {
  const ref = useReveal<HTMLElement>()

  return (
    <section
      ref={ref}
      id="contacto"
      className="relative py-24 md:py-40 px-6 border-t border-current/10"
    >
      <div className="mx-auto max-w-5xl text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-60" data-reveal>
          ⌗ 04 — Contacto
        </span>

        <h2
          className="mt-4 font-display text-4xl md:text-7xl uppercase tracking-wider leading-[0.95]"
          data-reveal
          data-reveal-delay="0.05"
        >
          ¿Tienes un<br />proyecto?
        </h2>

        <p
          className="mt-6 max-w-xl mx-auto font-mono text-sm md:text-base opacity-70"
          data-reveal
          data-reveal-delay="0.1"
        >
          Hablemos. Cuéntame qué necesitas y armamos el plan juntos.
        </p>

        <div
          className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center"
          data-reveal
          data-reveal-delay="0.15"
        >
          <MagneticButton
            href="mailto:4b1t2003@gmail.com"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-mono text-sm uppercase tracking-wider text-[#0a0a0a]"
            style={{
              background:
                'linear-gradient(135deg, var(--color-accent-pink), var(--color-accent-lime))',
            }}
          >
            Enviar email →
          </MagneticButton>

          {links.map((l) => (
            <MagneticButton
              key={l.href}
              href={l.href}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-mono text-sm uppercase tracking-wider border border-current/30 hover:border-current/70 transition-colors"
            >
              {l.label} ↗
            </MagneticButton>
          ))}
        </div>
      </div>
    </section>
  )
}
