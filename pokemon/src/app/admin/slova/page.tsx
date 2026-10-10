import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin'
import { adminAddWord, adminRemoveWord } from '@/app/actions/admin'
import { ActionForm } from '@/components/ActionForm'
import { Submit, inputCls } from '@/components/ui'
import { DEFAULT_BANNED_WORDS, normalizeNick } from '@/lib/nickname-filter'
import { AlertTriangle, X } from 'lucide-react'
import { panel } from '@/components/design'

export default async function AdminWords() {
  // Kontrola i na stránce, ne jen v layoutu (Next může layout při částečném vykreslení přeskočit).
  await requireAdmin()
  const extra = await prisma.bannedWord.findMany({ orderBy: { word: 'asc' } })
  // Kdo už teď má přezdívku se zakázaným slovem (např. po přidání nového slova).
  const words = [...DEFAULT_BANNED_WORDS.map(normalizeNick), ...extra.map((w) => w.word)]
  const users = await prisma.user.findMany({ select: { id: true, nickname: true } })
  const offenders = users.filter((u) => words.some((w) => normalizeNick(u.nickname).includes(w)))

  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold text-fg sm:text-[44px]">Zakázaná slova v přezdívkách</h1>
      <p className="max-w-2xl text-sm text-muted">
        Kontroluje se bez diakritiky, s převodem čísel na písmena (k0k0t → kokot) a bez teček a podtržítek. Stačí, když
        přezdívka slovo obsahuje. Nezadávej moc krátká slova, zablokovala by i nevinné přezdívky.
      </p>

      {offenders.length > 0 && (
        <section className={`${panel} p-5 text-sm`}>
          <p className="flex items-center gap-2 font-semibold text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            Existující účty s nevhodnou přezdívkou:
          </p>
          <ul className="mt-1 flex flex-wrap gap-3">
            {offenders.map((u) => (
              <li key={u.id}>
                <a href={`/admin/uzivatele/${u.id}`} className="font-semibold text-accent underline underline-offset-4">
                  {u.nickname}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ActionForm action={adminAddWord} className="flex max-w-md items-start gap-2">
        <input name="word" placeholder="nové slovo" className={inputCls} />
        <Submit>Přidat</Submit>
      </ActionForm>

      <section>
        <h2 className="mb-2 text-xl font-bold text-fg">Přidané správcem ({extra.length})</h2>
        <ul className="flex flex-wrap gap-2">
          {extra.map((w) => (
            <li key={w.word} className="flex items-center gap-1 rounded-full border border-line-strong bg-card px-3 py-1 text-sm text-fg">
              {w.word}
              <ActionForm action={adminRemoveWord} className="inline">
                <input type="hidden" name="word" value={w.word} />
                <button className="grid h-6 w-6 place-items-center rounded-full text-danger hover:bg-[color-mix(in_srgb,var(--danger)_8%,transparent)]" aria-label={`Odebrat ${w.word}`}>
                  <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </button>
              </ActionForm>
            </li>
          ))}
          {!extra.length && <li className="text-sm text-muted">Zatím žádná.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-bold text-fg">Výchozí seznam ({DEFAULT_BANNED_WORDS.length})</h2>
        <p className="text-sm text-muted">{DEFAULT_BANNED_WORDS.join(', ')}</p>
      </section>
    </div>
  )
}
