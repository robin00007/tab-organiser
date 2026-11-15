import { test } from 'node:test'
import assert from 'node:assert/strict'
import { duplicateKey, findExistingTab } from '../src/lib/duplicates.ts'

const tab = (id: number, url: string, windowId = 1, incognito = false) => ({ id, url, windowId, incognito })

test('only web pages can be duplicates', () => {
  for (const url of ['chrome://newtab/', 'chrome://extensions', 'about:blank', 'file:///tmp/a.html', '']) {
    assert.equal(duplicateKey(url), null, url)
  }
  assert.equal(duplicateKey(undefined), null)
  assert.notEqual(duplicateKey('http://example.com'), null)
})

test('spelling trivia does not make two URLs different', () => {
  assert.equal(duplicateKey('https://Example.com'), duplicateKey('https://example.com/'))
  assert.equal(duplicateKey('HTTPS://example.com/a'), duplicateKey('https://example.com/a'))
})

test('the path, query and fragment all count', () => {
  const base = duplicateKey('https://mail.google.com/mail/u/0/#inbox')
  assert.notEqual(base, duplicateKey('https://mail.google.com/mail/u/0/#sent'))
  assert.notEqual(duplicateKey('https://a.com/x?p=1'), duplicateKey('https://a.com/x?p=2'))
  assert.notEqual(duplicateKey('https://a.com/x'), duplicateKey('https://a.com/y'))
})

test('www and http are different pages, not the same one in disguise', () => {
  assert.notEqual(duplicateKey('https://www.a.com/'), duplicateKey('https://a.com/'))
  assert.notEqual(duplicateKey('http://a.com/'), duplicateKey('https://a.com/'))
})

test('a tab is matched with the other tab showing the same page', () => {
  const fresh = tab(10, 'https://github.com/acme/api')
  const open = [tab(1, 'https://example.com/'), tab(2, 'https://github.com/acme/api')]
  assert.equal(findExistingTab(fresh, open)?.id, 2)
})

test('no other tab shows the page, so there is nothing to merge into', () => {
  assert.equal(findExistingTab(tab(10, 'https://a.com/x'), [tab(1, 'https://a.com/y')]), null)
})

test('a tab is never its own duplicate', () => {
  const only = tab(10, 'https://a.com/')
  assert.equal(findExistingTab(only, [only]), null)
})

test('a tab on a browser page never merges, even with another one open', () => {
  assert.equal(findExistingTab(tab(10, 'chrome://newtab/'), [tab(1, 'chrome://newtab/')]), null)
})

test('a copy in the same window is preferred over one in another window', () => {
  const fresh = tab(10, 'https://a.com/', 2)
  const open = [tab(1, 'https://a.com/', 1), tab(2, 'https://a.com/', 2)]
  assert.equal(findExistingTab(fresh, open)?.id, 2)
})

test('a copy in another window is still found when none is local', () => {
  const fresh = tab(10, 'https://a.com/', 2)
  assert.equal(findExistingTab(fresh, [tab(1, 'https://a.com/', 1)])?.id, 1)
})

test('incognito and normal tabs never merge into each other', () => {
  const fresh = tab(10, 'https://a.com/', 1, true)
  assert.equal(findExistingTab(fresh, [tab(1, 'https://a.com/', 1, false)]), null)
  assert.equal(findExistingTab(fresh, [tab(2, 'https://a.com/', 1, true)])?.id, 2)
})
