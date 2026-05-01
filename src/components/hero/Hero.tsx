import DotTextMorph from '@/components/hero/DotTextMorph'
import MagneticButton from '@/components/ui/MagneticButton'

export default function Hero() {
  return (
    <section className="relative min-h-dvh flex flex-col items-center justify-center px-6 pt-28 pb-16">
      <span className="mb-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] opacity-60">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
        Disponible para proyectos
      </span>

      <DotTextMorph
        words={['FRONTEND', 'DESIGN', 'CODE', '4B1T']}
        className="w-full max-w-5xl h-[34vh] md:h-[44vh]"
      />

      <p className="mt-6 max-w-xl text-center font-mono text-sm md:text-base opacity-70">
        Construyo experiencias digitales que conectan.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <MagneticButton
          href="#proyectos"
          className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-mono text-sm uppercase tracking-wider text-[#0a0a0a] transition-shadow hover:shadow-[0_0_0_3px_rgba(232,255,107,0.35)]"
          style={{
            background:
              'linear-gradient(135deg, var(--color-accent-pink), var(--color-accent-lime))',
          }}
        >
          Ver proyectos
          <span aria-hidden>→</span>
        </MagneticButton>

        <MagneticButton
          href="#contacto"
          className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 font-mono text-sm uppercase tracking-wider border border-current/30 hover:border-current/70 transition-colors"
        >
          Contacto
        </MagneticButton>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.3em] opacity-40">
        Scroll ↓
      </div>
    </section>
  )
}
