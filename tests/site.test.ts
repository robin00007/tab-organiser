import { test } from 'node:test'
import assert from 'node:assert/strict'
import { siteProvider } from '../src/newtab/providers/site.ts'

const youtube = siteProvider({
  id: 'youtube',
  trigger: '/youtube',
  label: 'YouTube',
  home: 'https://www.youtube.com/',
  searchUrl: 'https://www.youtube.com/results?search_query={query}',
})

test('a site shortcut announces itself in the command list', () => {
  assert.equal(youtube.trigger, '/youtube')
  assert.equal(youtube.label, 'YouTube')
  assert.equal(youtube.hint, 'Search YouTube')
})

test('a query becomes one row that searches the site', async () => {
  const rows = await youtube.search('  lofi beats ')
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.kind, 'search')
  assert.equal(rows[0]?.title, 'Search YouTube for “lofi beats”')
  assert.equal(rows[0]?.subtitle, 'youtube.com')
})

test('the bare command offers to open the site', async () => {
  for (const query of ['', '   ']) {
    const rows = await youtube.search(query)
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.kind, 'link')
    assert.equal(rows[0]?.title, 'Open YouTube')
  }
})
