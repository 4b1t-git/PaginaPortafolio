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

    const onMove = (e: globalThis.MouseEvent) => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      tx = dx * strength
      ty = dy * strength
    }
    const onLeave = () => {
      tx = 0
      ty = 0
    }

    const tick = () => {
      cx += (tx - cx) * 0.18
      cy += (ty - cy) * 0.18
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

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
