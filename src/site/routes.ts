import type { Locale } from '../i18n'

export const SITE_URL = (import.meta.env?.VITE_SITE_URL || 'https://pkm-survivors-emegeaese.web.app').replace(/\/$/, '')

export const REPO_URL = 'https://github.com/Emegeaese/pkm-survivors'

/**
 * Every public URL, per language. `play` is the game itself (`index.html`,
 * `en/index.html`); the others are the static pages generated at build time.
 * These paths are linked from the game's title screen, so keep them stable.
 */
export const ROUTES = {
  play: { pt: '/', en: '/en/', es: '/es/' },
  pokedex: { pt: '/pokedex/', en: '/en/pokedex/', es: '/es/pokedex/' },
  guide: { pt: '/guia/', en: '/en/guide/', es: '/es/guia/' },
  changelog: { pt: '/novidades/', en: '/en/changelog/', es: '/es/novedades/' },
  legal: { pt: '/legal/', en: '/en/legal/', es: '/es/legal/' },
} as const satisfies Record<string, Record<Locale, string>>

export type RouteId = keyof typeof ROUTES

export const ROUTE_IDS = Object.keys(ROUTES) as RouteId[]

/** Pages rendered by `src/site` (everything but the game). */
export const PAGE_IDS = ROUTE_IDS.filter((id): id is Exclude<RouteId, 'play'> => id !== 'play')

export type PageId = (typeof PAGE_IDS)[number]

export const absolute = (path: string) => `${SITE_URL}${path}`

/** hreflang alternates of a route; English is the default for other languages, like the game pages. */
export const alternates = (id: RouteId) => [
  { hreflang: 'pt-BR', href: absolute(ROUTES[id].pt) },
  { hreflang: 'en', href: absolute(ROUTES[id].en) },
  { hreflang: 'es-MX', href: absolute(ROUTES[id].es) },
  { hreflang: 'x-default', href: absolute(ROUTES[id].en) },
]

/** sitemap.xml with every URL in both languages, each listing its alternates. */
export const sitemap = () => {
  const urls = ROUTE_IDS.flatMap((id) =>
    Object.values(ROUTES[id]).map((path) =>
      [
        '  <url>',
        `    <loc>${absolute(path)}</loc>`,
        ...alternates(id).map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`),
        '  </url>',
      ].join('\n'),
    ),
  )
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}
