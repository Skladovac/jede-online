// Fotky jsou předem zmenšené do několika šířek (webp) — prohlížeč si vybere podle `sizes`.

type ListingImg = { id: string; width: number; height: number; sizes: number[]; blur: string; alt: string }

export const listingSrcSet = (listingId: string, img: Pick<ListingImg, 'id' | 'sizes'>) =>
  [...img.sizes].sort((a, b) => a - b).map((w) => `/media/l/${listingId}/${img.id}-${w}.webp ${w}w`)

export const listingSrc = (listingId: string, img: Pick<ListingImg, 'id' | 'sizes'>, max = 1600) => {
  const sorted = [...img.sizes].sort((a, b) => a - b)
  const w = sorted.filter((s) => s <= max).pop() ?? sorted[0]
  return `/media/l/${listingId}/${img.id}-${w}.webp`
}

export function ListingPhoto({
  listingId,
  img,
  sizes,
  alt,
  className = '',
  priority = false,
}: {
  listingId: string
  img: ListingImg
  sizes: string
  alt: string
  className?: string
  priority?: boolean
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={listingSrc(listingId, img)}
      srcSet={listingSrcSet(listingId, img).join(', ')}
      sizes={sizes}
      width={img.width}
      height={img.height}
      alt={img.alt || alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
      style={img.blur ? { backgroundImage: `url(${img.blur})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    />
  )
}

/** Statická fotka z public/img: name = „hero/lukov“, widths = vygenerované šířky. */
export function StaticPhoto({
  name,
  widths,
  sizes,
  alt,
  width,
  height,
  className = '',
  priority = false,
}: {
  name: string
  widths: number[]
  sizes: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/img/${name}-${widths[Math.min(1, widths.length - 1)]}.webp`}
      srcSet={widths.map((w) => `/img/${name}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      width={width}
      height={height}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={className}
    />
  )
}
