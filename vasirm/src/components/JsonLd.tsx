// Strukturovaná data pro vyhledávače a AI. `<` se escapuje, aby text z DB nemohl ukončit <script>.
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
