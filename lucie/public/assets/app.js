document.documentElement.classList.add('js');
const menu = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
if (menu && navigation) {
  const closeMenu = (focus = false) => {
    navigation.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
    if (focus) menu.focus();
  };
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });
  navigation.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  window.matchMedia('(min-width: 761px)').addEventListener('change', () => closeMenu());
}
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
