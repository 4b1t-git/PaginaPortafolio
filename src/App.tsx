import Navbar from '@/components/nav/Navbar'
import CustomCursor from '@/components/ui/CustomCursor'
import DotField from '@/components/hero/DotField'
import Hero from '@/components/hero/Hero'
import Gallery from '@/components/gallery/Gallery'
import { useLenis } from '@/hooks/useLenis'

export default function App() {
  useLenis()

  return (
    <>
      <DotField />
      <CustomCursor />
      <Navbar />

      <main id="top" className="relative z-10">
        <Hero />

        <Gallery />

        <section
          id="sobre-mi"
          className="min-h-dvh flex items-center justify-center px-6 border-t border-current/10"
        >
          <p className="font-mono opacity-50">[Sobre mí — placeholder]</p>
        </section>

        <section
          id="contacto"
          className="min-h-[60vh] flex items-center justify-center px-6 border-t border-current/10"
        >
          <p className="font-mono opacity-50">[Contacto — placeholder]</p>
        </section>
      </main>
    </>
  )
}
