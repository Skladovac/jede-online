// Otázky dotazníku pro texty na web. Sdílí je server (ukládání, e-mail) i formulář v administraci.
// scope „team“ = stačí, když odpoví jeden z vás (druhý uvidí jeho odpověď).

export type Question = {
  key: string
  label: string
  hint?: string
  kind: 'text' | 'long' | 'number'
  scope?: 'team'
  optional?: boolean
}

export type Section = { title: string; intro?: string; questions: Question[] }

export const SECTIONS: Section[] = [
  {
    title: 'Váš příběh',
    intro: 'Pište vlastními slovy, klidně v bodech. Texty z toho napíšeme my a pošleme vám je ke schválení.',
    questions: [
      { key: 'zacatky', label: 'Jak jste se dostal(a) k realitám? Co jste dělal(a) předtím?', kind: 'long' },
      { key: 'bavi', label: 'Co vás na práci makléře nejvíc baví?', kind: 'long' },
      {
        key: 'pribeh_klienta',
        label: 'Na který obchod nebo příběh klienta nejraději vzpomínáte?',
        hint: 'Bez jmen klientů. Třeba prodej, který se povedl i přes komplikace, nebo rodina, které jste našli domov.',
        kind: 'long',
      },
      {
        key: 'jinak',
        label: 'V čem pracujete jinak než ostatní makléři? Co u vás klient dostane navíc?',
        hint: 'Konkrétně: jak často se klientovi ozýváte, co zařídíte za něj, s kým spolupracujete (fotograf, právník, hypotéky…).',
        kind: 'long',
      },
      { key: 'vzkaz', label: 'Co byste vzkázal(a) někomu, kdo váhá, jestli prodávat přes makléře?', kind: 'long' },
      {
        key: 'osobni',
        label: 'Něco osobního, co o vás klient může vědět',
        hint: 'Koníčky, rodina, váš vztah ke Zlínu… Lidé rádi vědí, s kým jednají.',
        kind: 'long',
        optional: true,
      },
    ],
  },
  {
    title: 'Specializace',
    questions: [
      {
        key: 'specializace',
        label: 'Na jaké nemovitosti se specializujete?',
        hint: 'Např. rodinné domy, byty, pozemky, novostavby, investiční nemovitosti, vícegenerační domy…',
        kind: 'text',
      },
      { key: 'lokality', label: 'Které lokality znáte nejlépe?', hint: 'Části Zlína, obce v okolí…', kind: 'text' },
      {
        key: 'vzdelani',
        label: 'Vzdělání, osvědčení, členství',
        hint: 'Např. osvědčení o odborné způsobilosti podle zákona o realitním zprostředkování, členství v ARK ČR, kurzy.',
        kind: 'long',
        optional: true,
      },
    ],
  },
  {
    title: 'Čísla',
    intro: 'Na web dáme jen čísla, která umíte doložit. Když něco nevíte přesně, napište odhad a poznámku „cca“, nebo nechte prázdné.',
    questions: [
      { key: 'rok_zacatku', label: 'V jakém roce jste začal(a) v realitách?', kind: 'number' },
      { key: 'prodano', label: 'Kolik nemovitostí jste za celou kariéru prodal(a)?', kind: 'number', optional: true },
      { key: 'doba_prodeje', label: 'Jak dlouho u vás průměrně trvá prodej (ve dnech)?', kind: 'number', optional: true },
      { key: 'cisla_poznamka', label: 'Poznámka k číslům', hint: 'Odkud čísla máte, co zahrnují.', kind: 'text', optional: true },
    ],
  },
  {
    title: 'Společně jako VRM',
    intro: 'Stačí, když odpoví jeden z vás. Druhý jeho odpověď uvidí a může doplnit.',
    questions: [
      { key: 'tym_zacatek', label: 'Jak jste začali pracovat spolu? Proč jako manželé v jedné kanceláři?', kind: 'long', scope: 'team' },
      { key: 'tym_sousede', label: 'Co pro vás znamená „Od sousedů pro sousedy“?', kind: 'long', scope: 'team' },
      { key: 'tym_role', label: 'Jak si dělíte práci? Kdo co u zakázky dělá?', kind: 'long', scope: 'team' },
      {
        key: 'tym_sluzby',
        label: 'Co všechno je v ceně vaší služby?',
        hint: 'Fotograf, video, dron, home staging, právní servis, úschova, pomoc s hypotékou, přepis energií…',
        kind: 'long',
        scope: 'team',
      },
    ],
  },
  {
    title: 'Údaje na web',
    intro: 'Tohle musí na webu být správně.',
    questions: [
      { key: 'jmeno_na_webu', label: 'Jak chcete být na webu uveden(a)? (jméno a příjmení přesně)', hint: 'Např. „Markéta Nedbálková“.', kind: 'text' },
      { key: 'telefon', label: 'Telefon na web', kind: 'text' },
      { key: 'email', label: 'E-mail na web', kind: 'text' },
      {
        key: 'ico',
        label: 'Provozovatel webu: jméno nebo firma, IČO a sídlo',
        hint: 'Podnikatel je musí mít na webu uvedené. Stačí jednou za oba.',
        kind: 'long',
        scope: 'team',
      },
      { key: 'dostupnost', label: 'Kdy berete telefon? (pro Google a web)', hint: 'Např. Po–Pá 8–18, So po domluvě.', kind: 'text', scope: 'team' },
      { key: 'video', label: 'Chcete natočit krátké video představení? Kdy by se vám hodilo?', kind: 'text', optional: true },
    ],
  },
]

export const QUESTIONS = SECTIONS.flatMap((s) => s.questions)
export const QUESTION_KEYS = new Set(QUESTIONS.map((q) => q.key))

export type Answers = Record<string, string>

export function readAnswers(json: unknown): Answers {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {}
  const out: Answers = {}
  for (const [k, v] of Object.entries(json)) if (QUESTION_KEYS.has(k) && typeof v === 'string') out[k] = v
  return out
}

/** Kolik povinných otázek je vyplněných (týmové se počítají, když je vyplnil kdokoli). */
export function progress(mine: Answers, team: Answers) {
  const required = QUESTIONS.filter((q) => !q.optional)
  const done = required.filter((q) => (mine[q.key] ?? '').trim() || (q.scope === 'team' && (team[q.key] ?? '').trim())).length
  return { done, total: required.length }
}
