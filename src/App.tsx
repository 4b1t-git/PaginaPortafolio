import Navbar from '@/components/nav/Navbar'
import Hero from '@/components/hero/Hero'
import Gallery from '@/components/gallery/Gallery'
import About from '@/components/sections/About'
import Stack from '@/components/sections/Stack'
import Contact from '@/components/sections/Contact'
import Footer from '@/components/sections/Footer'

export default function App() {
  return (
    <>
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
