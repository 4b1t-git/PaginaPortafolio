import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useReveal<T extends HTMLElement = HTMLElement>(
  selector: string = '[data-reveal]',
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const targets = root.querySelectorAll<HTMLElement>(selector)
    if (targets.length === 0) return

    const ctx = gsap.context(() => {
      targets.forEach((el) => {
        const delay = parseFloat(el.dataset.revealDelay ?? '0')
        const y = parseFloat(el.dataset.revealY ?? '24')

        if (reduced) {
          gsap.set(el, { opacity: 1, y: 0 })
          return
        }

        gsap.fromTo(
          el,
          { opacity: 0, y },
          {
            opacity: 1,
            y: 0,
            duration: 0.9,
            ease: 'power3.out',
            delay,
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          },
        )
      })
    }, root)

    return () => ctx.revert()
  }, [selector])

  return ref
}
