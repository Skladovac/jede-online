document.documentElement.classList.add('js');

// Menu: na mobilu a tabletu celostránkové, na desktopu běžná navigace.
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
if (menu && navigation) {
  const isOpen = () => menu.getAttribute('aria-expanded') === 'true';
  const setOpen = (open, returnFocus = false) => {
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('menu-open', open);
    if (open) navigation.querySelector('a')?.focus({ preventScroll: true });
    else if (returnFocus) menu.focus();
  };
  menu.addEventListener('click', () => setOpen(!isOpen()));
  navigation.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { setOpen(false, true); return; }
    if (e.key !== 'Tab') return;
    // Fokus zůstává uvnitř otevřeného menu.
    const items = [menu, ...navigation.querySelectorAll('a[href]')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  window.matchMedia('(min-width: 1000px)').addEventListener('change', () => setOpen(false));
}

// Mapa Google se načte až po kliknutí.
for (const button of document.querySelectorAll('[data-load-map]')) {
  button.addEventListener('click', () => {
    const panel = button.closest('[data-map-panel]');
    const iframe = document.createElement('iframe');
    iframe.title = 'Mapa: Mostecká 361, Vsetín';
    iframe.src = 'https://maps.google.com/maps?q=Mosteck%C3%A1%20361%2C%20Vset%C3%ADn&z=16&output=embed';
    iframe.referrerPolicy = 'no-referrer';
    iframe.allowFullscreen = true;
    const route = panel.querySelector('a').cloneNode(true);
    panel.replaceChildren(iframe, route);
    panel.classList.add('is-loaded');
    route.focus();
  }, { once: true });
}

// Jemné objevování obsahu při posouvání. Bez JS nebo s omezeným pohybem je vše rovnou vidět.
const revealItems = document.querySelectorAll('.reveal');
if (revealItems.length && 'IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.documentElement.classList.add('reveal-ready');
  revealItems.forEach(item => observer.observe(item));
}
