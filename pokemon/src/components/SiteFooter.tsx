export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 py-8 text-sm text-slate-500 dark:border-slate-800">
      <div className="mx-auto max-w-6xl space-y-2 px-4">
        <p>
          Neoficiální fanouškovský projekt. Pokémon a názvy karet jsou ochranné známky jejich vlastníků (Nintendo, The
          Pokémon Company). Data katalogu: TCGdex.
        </p>
        <p>
          Designed by{' '}
          <a href="https://jede.online" className="font-semibold text-[#C9A961] hover:text-[#D4AF37]">
            jede.online
          </a>
        </p>
      </div>
    </footer>
  )
}
