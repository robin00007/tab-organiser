import { siteProvider } from './site.ts'

export const youtubeProvider = siteProvider({
  id: 'youtube',
  trigger: '/youtube',
  aliases: ['/yt'],
  label: 'YouTube',
  home: 'https://www.youtube.com/',
  searchUrl: 'https://www.youtube.com/results?search_query={query}',
})
