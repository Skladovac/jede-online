import { prisma } from '@/lib/prisma'
import { adminAddWord, adminRemoveWord } from '@/app/actions/admin'
import { ActionForm } from '@/components/ActionForm'
import { Submit, inputCls } from '@/components/ui'
import { DEFAULT_BANNED_WORDS, normalizeNick } from '@/lib/nickname-filter'

export default async function AdminWords() {
  const extra = await prisma.bannedWord.findMany({ orderBy: { word: 'asc' } })
  // Kdo už teď má přezdívku se zakázaným slovem (např. po přidání nového slova).
  const words = [...DEFAULT_BANNED_WORDS.map(normalizeNick), ...extra.map((w) => w.word)]
  const users = await prisma.user.findMany({ select: { id: true, nickname: true } })
  const offenders = users.filter((u) => words.some((w) => normalizeNick(u.nickname).includes(w)))

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-black tracking-tight">Zakázaná slova v přezdívkách</h1>
      <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
        Kontroluje se bez diakritiky, s převodem čísel na písmena (k0k0t → kokot) a bez teček a podtržítek. Stačí, když
        přezdívka slovo obsahuje. Nezadávej moc krátká slova, zablokovala by i nevinné přezdívky.
      </p>

      {offenders.length > 0 && (
        <section className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm dark:border-red-500/40 dark:bg-red-500/10">
          <p className="font-semibold">Existující účty s nevhodnou přezdívkou:</p>
          <ul className="mt-1 flex flex-wrap gap-3">
            {offenders.map((u) => (
              <li key={u.id}>
                <a href={`/admin/uzivatele/${u.id}`} className="underline">
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
        <h2 className="mb-2 font-bold">Přidané správcem ({extra.length})</h2>
        <ul className="flex flex-wrap gap-2">
          {extra.map((w) => (
            <li key={w.word} className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-sm dark:border-slate-700">
              {w.word}
              <ActionForm action={adminRemoveWord} className="inline">
                <input type="hidden" name="word" value={w.word} />
                <button className="text-red-600" aria-label={`Odebrat ${w.word}`}>
                  ×
                </button>
              </ActionForm>
            </li>
          ))}
          {!extra.length && <li className="text-sm text-slate-500">Zatím žádná.</li>}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-bold">Výchozí seznam ({DEFAULT_BANNED_WORDS.length})</h2>
        <p className="text-sm text-slate-500">{DEFAULT_BANNED_WORDS.join(', ')}</p>
      </section>
    </div>
  )
}
