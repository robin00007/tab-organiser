import type { GroupColor } from './types.ts'

export interface Template {
  id: string
  name: string
  color: GroupColor
  /** Short pitch shown on the template card. */
  blurb: string
  /** Domain rules — the kind that needs no explanation to a first-time user. */
  domains: string[]
}

/**
 * Starter packs. These are only a seed: once added, a template becomes an
 * ordinary group the user can rename, recolour and extend.
 */
export const TEMPLATES: Template[] = [
  {
    id: 'social',
    name: 'Social',
    color: 'blue',
    blurb: 'Feeds and timelines',
    domains: [
      'x.com',
      'twitter.com',
      'facebook.com',
      'instagram.com',
      'reddit.com',
      'linkedin.com',
      'tiktok.com',
      'threads.com',
      'bsky.app',
      'pinterest.com',
      'snapchat.com',
      'quora.com',
    ],
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    color: 'pink',
    blurb: 'Video, music and streaming',
    domains: [
      'youtube.com',
      'netflix.com',
      'primevideo.com',
      'hotstar.com',
      'spotify.com',
      'twitch.tv',
      'disneyplus.com',
      'hulu.com',
      'soundcloud.com',
      'crunchyroll.com',
      'imdb.com',
      'jiocinema.com',
    ],
  },
  {
    id: 'work',
    name: 'Work',
    color: 'green',
    blurb: 'Docs, chat, calls and tickets',
    domains: [
      'docs.google.com',
      'sheets.google.com',
      'slides.google.com',
      'drive.google.com',
      'slack.com',
      'notion.so',
      'atlassian.net',
      'teams.microsoft.com',
      'zoom.us',
      'asana.com',
      'trello.com',
      'linear.app',
      'monday.com',
      'sharepoint.com',
    ],
  },
  {
    id: 'dev',
    name: 'Dev',
    color: 'purple',
    blurb: 'Code, docs and consoles',
    domains: [
      'github.com',
      'gitlab.com',
      'bitbucket.org',
      'stackoverflow.com',
      'npmjs.com',
      'developer.mozilla.org',
      'localhost',
      '127.0.0.1',
      'vercel.com',
      'console.aws.amazon.com',
      'portal.azure.com',
      'console.cloud.google.com',
      'codepen.io',
      'dev.to',
    ],
  },
  {
    id: 'ai',
    name: 'AI',
    color: 'cyan',
    blurb: 'Assistants and model playgrounds',
    domains: [
      'claude.ai',
      'chatgpt.com',
      'gemini.google.com',
      'perplexity.ai',
      'huggingface.co',
      'copilot.microsoft.com',
      'console.anthropic.com',
      'platform.openai.com',
      'midjourney.com',
    ],
  },
  {
    id: 'email',
    name: 'Email',
    color: 'red',
    blurb: 'Inboxes',
    domains: ['mail.google.com', 'outlook.office.com', 'outlook.live.com', 'mail.proton.me', 'mail.yahoo.com', 'zoho.com'],
  },
  {
    id: 'shopping',
    name: 'Shopping',
    color: 'orange',
    blurb: 'Carts and wishlists',
    domains: [
      'amazon.com',
      'amazon.in',
      'flipkart.com',
      'ebay.com',
      'etsy.com',
      'myntra.com',
      'aliexpress.com',
      'walmart.com',
      'ikea.com',
    ],
  },
  {
    id: 'news',
    name: 'News',
    color: 'yellow',
    blurb: 'Headlines and tech press',
    domains: [
      'news.google.com',
      'bbc.com',
      'cnn.com',
      'nytimes.com',
      'theverge.com',
      'techcrunch.com',
      'news.ycombinator.com',
      'arstechnica.com',
      'reuters.com',
      'indianexpress.com',
    ],
  },
  {
    id: 'learning',
    name: 'Learning',
    color: 'grey',
    blurb: 'Courses and practice',
    domains: [
      'coursera.org',
      'udemy.com',
      'khanacademy.org',
      'leetcode.com',
      'w3schools.com',
      'geeksforgeeks.org',
      'freecodecamp.org',
      'pluralsight.com',
      'edx.org',
    ],
  },
  {
    id: 'finance',
    name: 'Finance',
    color: 'green',
    blurb: 'Banking, markets and payments',
    domains: [
      'paypal.com',
      'tradingview.com',
      'coinbase.com',
      'zerodha.com',
      'groww.in',
      'binance.com',
      'mint.intuit.com',
      'nseindia.com',
    ],
  },
]

export const TEMPLATES_BY_ID = new Map(TEMPLATES.map((template) => [template.id, template]))

/** Templates seeded when the extension is installed, before any onboarding. */
export const DEFAULT_TEMPLATE_IDS = ['social', 'entertainment', 'work', 'dev'] as const
