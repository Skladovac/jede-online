export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Pokémon karty</h1>
      <p className="text-lg text-slate-600 dark:text-slate-300">
        Sbírka, chybějící karty a výměny mezi sběrateli z Česka a Slovenska.
      </p>
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        Připravujeme. Služba je zatím v uzavřeném testování.
      </p>
      <footer className="pt-10 text-sm text-slate-500">
        Designed by{' '}
        <a href="https://jede.online" className="font-semibold text-[#C9A961] hover:text-[#D4AF37]">
          jede.online
        </a>
      </footer>
    </main>
  )
}
