import ThemeToggle from '@/components/ui/ThemeToggle'

const links = [
  { id: 'proyectos', label: 'Proyectos' },
  { id: 'sobre-mi', label: 'Sobre mí' },
  { id: 'contacto', label: 'Contacto' },
]

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Navbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 backdrop-blur-md">
        <button
          onClick={() => scrollTo('top')}
          className="font-display text-lg uppercase tracking-[0.2em] hover:opacity-70 transition-opacity"
        >
          Ignacio R.
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollTo(l.id)}
              className="font-mono text-xs uppercase tracking-wider px-3 py-2 rounded-full hover:bg-current/5 transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
