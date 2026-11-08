// Patičku mají všechny klientské weby stejnou: jede.online zlatě, s odkazem na hlavní web.
export function Footer() {
  return (
    <footer className="border-t border-line py-6 text-center text-sm text-subtle">
      Designed by{' '}
      <a href="https://jede.online" className="font-semibold text-[#C9A961] hover:text-[#D4AF37]">
        jede.online
      </a>
    </footer>
  )
}
