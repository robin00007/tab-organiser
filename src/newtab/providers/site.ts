import { buildSiteUrl, type Provider } from '../../lib/universal.ts'

export interface Site {
  id: string
  /** What the user types, such as `/youtube`. */
  trigger: string
  /** Shorter names that work too, such as `/yt`. */
  aliases?: readonly string[]
  /** The site's name, used in the badge and the row titles. */
  label: string
  /** Where the bare command goes. */
  home: string
  /** The site's own search address, with `{query}` where the text belongs. */
  searchUrl: string
}

/**
 * A command that hands the query to a website's own search, so `/youtube lofi`
 * lands on exactly the page YouTube's search box would have produced.
 *
 * Nothing is sent anywhere while the user types: the page only navigates when a
 * row is picked, so no site learns what was typed unless it is actually opened.
 * Navigating the new tab itself, rather than opening another, lets the service
 * worker's duplicate merge recognise a results page that is already open.
 */
export function siteProvider(site: Site): Provider {
  const host = new URL(site.home).hostname.replace(/^www\./, '')

  return {
    id: site.id,
    trigger: site.trigger,
    ...(site.aliases ? { aliases: site.aliases } : {}),
    label: site.label,
    // Aliases are not listed on their own, so the one listing says they exist.
    hint: `Search ${site.label}` + (site.aliases?.length ? ` (also ${site.aliases.join(', ')})` : ''),

    async search(query) {
      const text = query.trim()
      const url = text ? buildSiteUrl(site.searchUrl, text) : site.home
      return [
        {
          id: `${site.id}:go`,
          kind: text ? 'search' : 'link',
          title: text ? `Search ${site.label} for “${text}”` : `Open ${site.label}`,
          subtitle: host,
          activate: () => window.location.assign(url),
        },
      ]
    },
  }
}
