import { useEffect, useRef, type ReactNode, type CSSProperties } from 'react'

type Props = {
  href?: string
  onClick?: () => void
  children: ReactNode
  strength?: number
  className?: string
  style?: CSSProperties
}

export default function MagneticButton({
  href,
  onClick,
  children,
  strength = 0.35,
  className,
  style,
}: Props) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement | null>(null)

  useEffect(() => {
    const el = ref.current as HTMLElement | null
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let rafId = 0
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let running = false

    const tick = () => {
      cx += (tx - cx) * 0.18
      cy += (ty - cy) * 0.18
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
      // Detén el RAF cuando el botón vuelve al reposo: nada que animar
      // hasta el próximo mouseenter.
      if (tx === 0 && ty === 0 && Math.abs(cx) < 0.1 && Math.abs(cy) < 0.1) {
        cx = 0
        cy = 0
        el.style.transform = 'translate3d(0,0,0)'
        running = false
        return
      }
      rafId = requestAnimationFrame(tick)
    }

    const start = () => {
      if (running) return
      running = true
      rafId = requestAnimationFrame(tick)
    }

    const onMove = (e: globalThis.MouseEvent) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      tx = dx * strength
      ty = dy * strength
      start()
    }
    const onLeave = () => {
      tx = 0
      ty = 0
      start()
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(rafId)
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [strength])

  if (href) {
    return (
      <a
        ref={ref as React.RefObject<HTMLAnchorElement>}
        href={href}
        className={className}
        style={style}
        data-cursor="hover"
      >
        {children}
      </a>
    )
  }
  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      onClick={onClick}
      className={className}
      style={style}
      data-cursor="hover"
    >
      {children}
    </button>
  )
}
