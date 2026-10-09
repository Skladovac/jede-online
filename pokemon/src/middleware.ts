import { NextResponse, type NextRequest } from 'next/server'

/**
 * Profily sběratelů mají adresu /@přezdívka (Next.js neumí složku začínající „@“ — ta je vyhrazená pro paralelní routy),
 * takže /@… interně přepíšeme na /u/…; staré odkazy /u/… trvale přesměrujeme na /@….
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const at = pathname.startsWith('/@') ? 2 : pathname.startsWith('/%40') ? 4 : 0
  if (at) {
    const url = req.nextUrl.clone()
    url.pathname = `/u/${pathname.slice(at)}`
    return NextResponse.rewrite(url)
  }
  if (pathname.startsWith('/u/')) {
    const url = req.nextUrl.clone()
    url.pathname = `/@${pathname.slice(3)}`
    url.search = search
    return NextResponse.redirect(url, 308)
  }
  return NextResponse.next()
}

// Vzor '/@:path*' Next.js nezachytí (znak @), proto širší matcher bez statických souborů a API.
export const config = { matcher: ['/((?!_next/|api/|img/|favicon|icon|apple-icon|robots.txt|sitemap).*)'] }
