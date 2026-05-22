import { useEffect, useRef } from 'react'

// Scroll reveal con IntersectionObserver puro — sin GSAP.
// Cada `[data-reveal]` arranca oculto (opacity 0 + translateY) y se anima
// vía transición CSS al entrar al viewport. Soporta data-reveal-delay y
// data-reveal-y. Se re-oculta al salir para re-animar al volver (como el
// toggleActions reverse del setup anterior).
export function useReveal<T extends HTMLElement = HTMLElement>(
  selector: string = '[data-reveal]',
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return

    const targets = Array.from(root.querySelectorAll<HTMLElement>(selector))
    if (targets.length === 0) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      targets.forEach((el) => {
        el.style.opacity = '1'
        el.style.transform = 'none'
      })
      return
    }

    const ease = 'cubic-bezier(0.22, 1, 0.36, 1)'
    const hide = (el: HTMLElement) => {
      const y = parseFloat(el.dataset.revealY ?? '24')
      el.style.opacity = '0'
      el.style.transform = `translateY(${y}px)`
    }
    targets.forEach((el) => {
      const delay = parseFloat(el.dataset.revealDelay ?? '0')
      el.style.transition = `opacity 0.9s ${ease} ${delay}s, transform 0.9s ${ease} ${delay}s`
      el.style.willChange = 'opacity, transform'
      hide(el)
    })

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLElement
          if (entry.isIntersecting) {
            el.style.opacity = '1'
            el.style.transform = 'none'
          } else {
            hide(el)
          }
        })
      },
      { rootMargin: '0px 0px -15% 0px', threshold: 0 },
    )
    targets.forEach((el) => io.observe(el))

    return () => io.disconnect()
  }, [selector])

  return ref
}
