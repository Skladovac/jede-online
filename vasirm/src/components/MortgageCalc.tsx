'use client'

import { useId, useState } from 'react'
import { formatPrice, monthlyPayment } from '@/lib/format'

/** Orientační splátka hypotéky. Sazba je jen výchozí odhad — návštěvník si ji upraví. */
export function MortgageCalc({ price }: { price: number }) {
  const id = useId()
  const [own, setOwn] = useState(20)
  const [rate, setRate] = useState(4.6)
  const [years, setYears] = useState(30)
  const loan = Math.round((price * (100 - own)) / 100)
  const pay = monthlyPayment(loan, rate, years)

  return (
    <div className="border border-ink/10 bg-white p-6 sm:p-8">
      <p className="label text-gold-deep">Orientační splátka</p>
      <p className="mt-3 font-serif text-[2.6rem] leading-none tabular-nums">
        {formatPrice(Math.round(pay / 10) * 10)}
        <span className="ml-1 font-sans text-base text-stone">/ měsíc</span>
      </p>
      <p className="mt-2 text-sm text-stone">Úvěr {formatPrice(loan)}</p>

      <div className="mt-7 space-y-6">
        <Range id={`${id}-own`} label="Vlastní zdroje" value={own} min={10} max={60} step={5} unit="%" onChange={setOwn} extra={formatPrice(price - loan)} />
        <Range id={`${id}-rate`} label="Úroková sazba" value={rate} min={2} max={8} step={0.1} unit="%" onChange={setRate} />
        <Range id={`${id}-years`} label="Doba splácení" value={years} min={5} max={30} step={1} unit=" let" onChange={setYears} />
      </div>
      <p className="mt-6 text-xs leading-relaxed text-stone">
        Výpočet je pouze orientační. S financováním vám rádi pomohou naši kolegové — zeptejte se při prohlídce.
      </p>
    </div>
  )
}

function Range({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  extra,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
  extra?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="tabular-nums text-ink">
          {value.toLocaleString('cs-CZ')}
          {unit}
          {extra && <span className="text-stone"> · {extra}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[#c5a880]"
      />
    </div>
  )
}
