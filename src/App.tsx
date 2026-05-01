import Navbar from '@/components/nav/Navbar'
import CustomCursor from '@/components/ui/CustomCursor'
import DotField from '@/components/hero/DotField'
import Hero from '@/components/hero/Hero'
import Gallery from '@/components/gallery/Gallery'
import About from '@/components/sections/About'
import Stack from '@/components/sections/Stack'
import Contact from '@/components/sections/Contact'
import Footer from '@/components/sections/Footer'
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
        <About />
        <Stack />
        <Contact />
        <Footer />
      </main>
    </>
  )
}
