import Navbar from '@/components/nav/Navbar'
import CustomCursor from '@/components/ui/CustomCursor'
import DotTextMorph from '@/components/hero/DotTextMorph'
import { useLenis } from '@/hooks/useLenis'

export default function App() {
  useLenis()

  return (
    <>
      <CustomCursor />
      <Navbar />

      <main id="top" className="min-h-dvh">
        <section className="relative min-h-dvh flex flex-col items-center justify-center px-6 pt-24">
          <DotTextMorph
            words={['FRONTEND', 'DESIGN', 'CODE', '4B1T']}
            className="w-full max-w-5xl h-[40vh] md:h-[50vh]"
          />
          <div className="mt-8 text-center space-y-5 max-w-xl">
            <p className="font-mono text-sm md:text-base opacity-70">
              Construyo experiencias digitales que conectan.
            </p>
            <a
              href="#proyectos"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 font-mono text-sm uppercase tracking-wider text-[#0a0a0a] transition-transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-pink), var(--color-accent-lime))',
              }}
            >
              Ver proyectos →
            </a>
          </div>
        </section>

        <section id="proyectos" className="min-h-dvh flex items-center justify-center px-6 border-t border-current/10">
          <p className="font-mono opacity-50">[Proyectos — placeholder]</p>
        </section>

        <section id="sobre-mi" className="min-h-dvh flex items-center justify-center px-6 border-t border-current/10">
          <p className="font-mono opacity-50">[Sobre mí — placeholder]</p>
        </section>

        <section id="contacto" className="min-h-[60vh] flex items-center justify-center px-6 border-t border-current/10">
          <p className="font-mono opacity-50">[Contacto — placeholder]</p>
        </section>
      </main>
    </>
  )
}
