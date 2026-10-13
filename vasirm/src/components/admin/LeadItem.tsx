'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { ChevronDown, Mail, Phone, Trash2 } from 'lucide-react'
import type { LeadStatus, LeadType } from '@prisma/client'
import { deleteLead, saveLeadNote, setLeadStatus } from '@/app/actions/admin'
import { formatDateTime } from '@/lib/format'
import { LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from '@/lib/labels'

type Lead = {
  id: string
  type: LeadType
  status: LeadStatus
  name: string
  email: string
  phone: string
  message: string
  note: string
  data: Record<string, string>
  createdAt: string
  listing: { title: string; slug: string; locality: string } | null
}

const DATA_LABEL: Record<string, string> = {
  typ: 'Typ',
  lokalita: 'Lokalita',
  plocha: 'Plocha (m²)',
  pozemek: 'Pozemek (m²)',
  dispozice: 'Dispozice',
  stav: 'Stav',
  kdy: 'Prodej',
}

const STATUS_STYLE: Record<LeadStatus, string> = {
  NEW: 'bg-gold text-ink',
  IN_PROGRESS: 'bg-sky-100 text-sky-900',
  DONE: 'bg-emerald-100 text-emerald-900',
  SPAM: 'bg-paper-2 text-stone',
}

export function LeadItem({ lead: l, open: initialOpen }: { lead: Lead; open?: boolean }) {
  const [open, setOpen] = useState(!!initialOpen)
  const [pending, start] = useTransition()
  const ref = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (initialOpen) ref.current?.scrollIntoView({ block: 'center' })
  }, [initialOpen])

  const details = Object.entries(l.data).filter(([k, v]) => v && DATA_LABEL[k])

  return (
    <li ref={ref} className={`border bg-white ${initialOpen ? 'border-gold' : 'border-ink/10'} ${pending ? 'opacity-60' : ''}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-left" aria-expanded={open}>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[l.status]}`}>{LEAD_STATUS_LABEL[l.status]}</span>
        <span className="font-semibold">{l.name}</span>
        <span className="text-sm text-stone">
          {LEAD_TYPE_LABEL[l.type]}
          {l.listing ? ` · ${l.listing.title}, ${l.listing.locality}` : l.data.lokalita ? ` · ${l.data.lokalita}` : ''}
        </span>
        <span className="ml-auto flex items-center gap-2 text-sm tabular-nums text-stone">
          {formatDateTime(new Date(l.createdAt))}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>

      {open && (
        <div className="grid gap-6 border-t border-ink/10 px-5 py-5 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {l.phone && (
                <a href={`tel:${l.phone.replace(/[^\d+]/g, '')}`} className="btn-ink min-h-[2.5rem] px-4 text-sm">
                  <Phone className="h-4 w-4" aria-hidden /> {l.phone}
                </a>
              )}
              {l.email && (
                <a href={`mailto:${l.email}`} className="btn-ghost-dark min-h-[2.5rem] px-4 text-sm">
                  <Mail className="h-4 w-4" aria-hidden /> {l.email}
                </a>
              )}
            </div>
            {l.listing && (
              <p className="text-sm">
                Nemovitost:{' '}
                <a href={`/nabidka/${l.listing.slug}`} target="_blank" className="font-semibold underline decoration-gold underline-offset-4">
                  {l.listing.title}, {l.listing.locality}
                </a>
              </p>
            )}
            {details.length > 0 && (
              <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-stone">{DATA_LABEL[k]}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {l.message && <p className="whitespace-pre-wrap border-l-2 border-gold bg-paper-2 px-4 py-3 text-[0.95rem] leading-relaxed">{l.message}</p>}
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Stav</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={s === l.status || pending}
                    onClick={() => start(() => setLeadStatus(l.id, s))}
                    className={`rounded-full border px-3.5 py-1.5 text-sm transition ${s === l.status ? 'border-ink bg-ink text-paper' : 'border-ink/15 hover:border-ink/40'}`}
                  >
                    {LEAD_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Interní poznámka</span>
              <textarea
                defaultValue={l.note}
                rows={3}
                onBlur={(e) => e.target.value !== l.note && start(() => saveLeadNote(l.id, e.target.value))}
                placeholder="Např. volala jsem 12. 10., prohlídka v pátek…"
                className="field text-sm"
              />
              <span className="mt-1 block text-xs text-stone">Uloží se samo, když kliknete jinam. Zájemce poznámku nevidí.</span>
            </label>
            <button
              type="button"
              onClick={() => confirm('Smazat poptávku natrvalo?') && start(() => deleteLead(l.id))}
              className="inline-flex items-center gap-1.5 text-sm text-red-700 hover:underline"
            >
              <Trash2 className="h-4 w-4" aria-hidden /> Smazat
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
