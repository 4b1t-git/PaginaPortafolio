import { useTheme } from '@/hooks/useTheme'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
      className="group relative inline-flex h-9 w-16 items-center rounded-full border border-current/20 bg-transparent px-1 transition-colors hover:border-current/50"
    >
      <span
        className="inline-block h-7 w-7 rounded-full bg-current transition-transform duration-300 ease-out"
        style={{ transform: isDark ? 'translateX(28px)' : 'translateX(0)' }}
        aria-hidden
      />
      <span className="sr-only">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  )
}
