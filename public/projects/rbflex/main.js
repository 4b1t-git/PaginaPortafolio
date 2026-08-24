/* ─────────────────────────────────────────
   RB Flex — versión preview para el portfolio.
   Solo animaciones de frontend: scroll reveal, navbar glass, slider,
   resaltado de navegación y carcasa visual de WhatsApp. Sin envío de
   formulario ni acciones comerciales — todos los controles quedan inertes.
───────────────────────────────────────── */
(function () {
  'use strict';

  /* ─── SCROLL REVEAL — IntersectionObserver ─── */
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.13, rootMargin: '0px 0px -40px 0px' }
  );
  revealEls.forEach((el) => observer.observe(el));

  /* ─── NAVBAR — glass on scroll ─── */
  const navbar = document.getElementById('navbar');
  if (navbar) {
    navbar.classList.toggle('scrolled', window.scrollY > 30);
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 30);
    }, { passive: true });
  }

  /* ─── SLIDER — loop infinito ─── */
  const wrapper    = document.querySelector('.slider-wrapper');
  const track      = document.getElementById('sliderTrack');
  const btnPrev    = document.getElementById('sliderPrev');
  const btnNext    = document.getElementById('sliderNext');
  const dots       = document.querySelectorAll('.dot');
  const origSlides = Array.from(document.querySelectorAll('.slide'));
  const total      = origSlides.length;
  let position     = 1;
  let autoTimer    = null;
  let safetyTimer  = null;
  let isAnimating  = false;
  let isHovering   = false;

  if (track && total > 0) {
    if (wrapper) wrapper.classList.add('visible');

    track.appendChild(origSlides[0].cloneNode(true));
    track.prepend(origSlides[total - 1].cloneNode(true));

    const getAllSlides = () => track.querySelectorAll('.slide');

    function setSlideSizes() {
      if (!wrapper) return;
      const w = wrapper.clientWidth;
      getAllSlides().forEach((s) => {
        s.style.width    = w + 'px';
        s.style.minWidth = w + 'px';
      });
    }

    function updateDots() {
      const dotIdx = ((position - 1) + total) % total;
      dots.forEach((d, i) => d.classList.toggle('active', i === dotIdx));
    }

    function goTo(idx, animated = true) {
      if (!wrapper || !track) return;
      if (animated && isAnimating) return;

      const gap = 24;
      clearTimeout(safetyTimer);

      if (animated) {
        track.style.transition = 'transform 0.6s cubic-bezier(0.4,0,0.2,1)';
        void track.offsetHeight;
        isAnimating = true;
        safetyTimer = setTimeout(() => { isAnimating = false; }, 900);
      } else {
        track.style.transition = 'none';
      }

      position = idx;
      track.style.transform = `translateX(-${position * (wrapper.clientWidth + gap)}px)`;

      if (!animated) void track.offsetHeight;
      updateDots();
    }

    track.addEventListener('transitionend', (e) => {
      if (e.target !== track || e.propertyName !== 'transform') return;
      clearTimeout(safetyTimer);
      if (position === 0) goTo(total, false);
      else if (position === total + 1) goTo(1, false);
      isAnimating = false;
    });

    function next() { goTo(position + 1, true); }
    function prev() { goTo(position - 1, true); }

    function startAuto() {
      stopAuto();
      autoTimer = setInterval(next, 5000);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    if (btnNext) btnNext.addEventListener('click', () => { next(); startAuto(); });
    if (btnPrev) btnPrev.addEventListener('click', () => { prev(); startAuto(); });

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.idx, 10);
        if (isNaN(idx)) return;
        goTo(idx + 1);
        startAuto();
      });
    });

    if (wrapper) {
      wrapper.addEventListener('mouseenter', () => { isHovering = true;  stopAuto(); });
      wrapper.addEventListener('mouseleave', () => { isHovering = false; startAuto(); });
    }

    let resizeTimer = null;
    const reflow = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!wrapper.clientWidth) return;
        isAnimating = false;
        setSlideSizes();
        goTo(position, false);
      }, 60);
    };
    window.addEventListener('resize', reflow, { passive: true });

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(reflow);
      ro.observe(wrapper);
    }
    window.addEventListener('load', reflow);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopAuto();
      } else {
        isAnimating = false;
        if (!isHovering) startAuto();
      }
    });

    let touchStartX = 0;
    track.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      stopAuto();
    }, { passive: true });
    track.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
      startAuto();
    }, { passive: true });

    requestAnimationFrame(() => {
      setSlideSizes();
      goTo(1, false);
      startAuto();
    });
  }

  /* ─── WHATSAPP — visible como en producción, pero sin acción ─── */
  const waBubble = document.getElementById('wa-bubble');
  if (waBubble) waBubble.classList.add('visible');

  const contactSection = document.getElementById('contacto');
  if (contactSection && waBubble) {
    const contactObserver = new IntersectionObserver(
      ([entry]) => waBubble.classList.toggle('wa-hidden', entry.isIntersecting),
      { threshold: 0.15 }
    );
    contactObserver.observe(contactSection);
  }

  /* ─── ACTIVE NAV LINK highlight ─── */
  const sections   = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-links a');
  const secObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navAnchors.forEach((a) => {
            a.style.color = '';
            if (a.getAttribute('href') === `#${entry.target.id}`) {
              a.style.color = 'var(--accent)';
            }
          });
        }
      });
    },
    { threshold: 0.4 }
  );
  sections.forEach((s) => secObserver.observe(s));

  /* ─── ANCHOR LINKS — scroll sin cambiar la URL ─── */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ─── FORMULARIO — inerte en la preview (sin envío real) ─── */
  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const feedback = document.getElementById('form-feedback');
      if (feedback) {
        feedback.textContent = 'Demo del portfolio — el formulario no envía datos.';
        feedback.className = 'form-feedback';
      }
    });
  }

})();
