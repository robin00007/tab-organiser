import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchTabs, tokenize } from '../src/lib/search.ts'

const tab = (title: string, url: string) => ({ title, url })

const OPEN = [
  tab('Inbox (12) - Gmail', 'https://mail.google.com/mail/u/0/#inbox'),
  tab('robin0007 on Instagram', 'https://www.instagram.com/robin0007/'),
  tab('lofi hip hop radio - YouTube', 'https://www.youtube.com/watch?v=jfKfPfyJRdk'),
  tab('Extensions', 'chrome://extensions'),
  tab('Pricing', 'https://example.com/pricing?ref=youtube'),
]

const titles = (query: string) => searchTabs(OPEN, query).map((hit) => hit.title)

test('an empty query returns nothing, so the caller can show its normal body', () => {
  for (const query of ['', '   ']) assert.deepEqual(searchTabs(OPEN, query), [])
  assert.deepEqual(tokenize('  '), [])
})

test('a query matches the title or the address, case-insensitively', () => {
  assert.deepEqual(titles('GMAIL'), ['Inbox (12) - Gmail'])
  assert.deepEqual(titles('mail.google'), ['Inbox (12) - Gmail'])
})

test('browser pages are searchable even though they are never organised', () => {
  assert.deepEqual(titles('extensions'), ['Extensions'])
})

test('a hit in the title or host outranks one buried in a query string', () => {
  assert.deepEqual(titles('youtube'), ['lofi hip hop radio - YouTube', 'Pricing'])
})

test('every word has to land somewhere, so extra words narrow the list', () => {
  assert.deepEqual(titles('lofi youtube'), ['lofi hip hop radio - YouTube'])
  assert.deepEqual(titles('lofi gmail'), [])
})

test('a word start beats the same text mid-word', () => {
  const tabs = [tab('Programmable radio', 'https://example.org/a'), tab('Radio lofi', 'https://example.org/b')]
  assert.deepEqual(
    searchTabs(tabs, 'radio').map((hit) => hit.title),
    ['Radio lofi', 'Programmable radio'],
  )
})

test('tabs the caller listed first win ties, which keeps the current window on top', () => {
  const here = tab('Instagram', 'https://www.instagram.com/')
  const elsewhere = tab('Instagram', 'https://www.instagram.com/')
  assert.equal(searchTabs([here, elsewhere], 'instagram')[0], here)
  assert.equal(searchTabs([elsewhere, here], 'instagram')[0], elsewhere)
})

test('tabs with no title or address are simply skipped', () => {
  assert.deepEqual(searchTabs([{}, { title: 'Loading…' }], 'loading'), [{ title: 'Loading…' }])
})
