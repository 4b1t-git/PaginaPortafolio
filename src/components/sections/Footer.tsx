export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="relative px-6 py-10 border-t border-current/10">
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.2em] opacity-60">
        <span>© {year} — Ignacio R.</span>
        <span>Construido con Vite + React</span>
        <a
          href="https://github.com/4b1t-git/PaginaPortafolio"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-100 hover:underline"
        >
          Código ↗
        </a>
      </div>
    </footer>
  )
}
