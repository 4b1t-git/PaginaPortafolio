import { useEffect, useRef } from 'react'

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isCoarse = window.matchMedia('(pointer: coarse)').matches
    if (reduced || isCoarse) return

    document.documentElement.classList.add('has-custom-cursor')

    const dot = dotRef.current!
    const ring = ringRef.current!

    let mouseX = window.innerWidth / 2
    let mouseY = window.innerHeight / 2
    let ringX = mouseX
    let ringY = mouseY

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`
    }

    const onEnter = (e: Event) => {
      const t = e.target as HTMLElement
      if (t.closest('a, button, [data-cursor="hover"]')) {
        ring.dataset.hover = 'true'
      }
    }
    const onLeave = (e: Event) => {
      const t = e.target as HTMLElement
      if (t.closest('a, button, [data-cursor="hover"]')) {
        ring.dataset.hover = 'false'
      }
    }

    let rafId: number
    const tick = () => {
      ringX += (mouseX - ringX) * 0.18
      ringY += (mouseY - ringY) * 0.18
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onEnter)
    document.addEventListener('mouseout', onLeave)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onEnter)
      document.removeEventListener('mouseout', onLeave)
      document.documentElement.classList.remove('has-custom-cursor')
    }
  }, [])

  return (
    <>
      <div ref={dotRef} className="custom-cursor-dot" aria-hidden />
      <div ref={ringRef} className="custom-cursor-ring" aria-hidden />
    </>
  )
}
