import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeUrl, parseInput, toUrl } from '../src/lib/universal.ts'

interface Source {
  id: string
  trigger?: string
}

const tabs: Source = { id: 'tab', trigger: '/tab' }
const bookmarks: Source = { id: 'bm', trigger: '/bm' }
const tables: Source = { id: 'tbl', trigger: '/table' }
const web: Source = { id: 'web' }
const COMMANDS = [tabs, bookmarks]

const parse = (text: string, commands: Source[] = COMMANDS) => parseInput(text, commands, web)

test('plain text goes to the default source, trimmed', () => {
  assert.deepEqual(parse('  hello world '), { mode: 'search', provider: web, query: 'hello world' })
  assert.deepEqual(parse(''), { mode: 'search', provider: web, query: '' })
})

test('a command followed by text searches that source', () => {
  assert.deepEqual(parse('/tab xyz'), { mode: 'search', provider: tabs, query: 'xyz' })
  assert.deepEqual(parse('/tab   two words  '), { mode: 'search', provider: tabs, query: 'two words' })
  assert.deepEqual(parse('/bm docs'), { mode: 'search', provider: bookmarks, query: 'docs' })
})

test('a command on its own searches that source with an empty query', () => {
  assert.deepEqual(parse('/tab'), { mode: 'search', provider: tabs, query: '' })
  assert.deepEqual(parse('/tab '), { mode: 'search', provider: tabs, query: '' })
})

test('commands are case-insensitive and tolerate leading space', () => {
  assert.deepEqual(parse('/TAB Gmail'), { mode: 'search', provider: tabs, query: 'Gmail' })
  assert.deepEqual(parse('   /tab gmail'), { mode: 'search', provider: tabs, query: 'gmail' })
})

test('a lone slash or a partial command lists the commands that fit', () => {
  assert.deepEqual(parse('/'), { mode: 'commands', matches: COMMANDS })
  assert.deepEqual(parse('/t'), { mode: 'commands', matches: [tabs] })
  assert.deepEqual(parse('/ta'), { mode: 'commands', matches: [tabs] })
  assert.deepEqual(parse('/b'), { mode: 'commands', matches: [bookmarks] })
})

test('an exact command wins over a longer one that shares its start', () => {
  assert.deepEqual(parse('/tab', [tabs, tables]), { mode: 'search', provider: tabs, query: '' })
  assert.deepEqual(parse('/tab', [tables]), { mode: 'commands', matches: [tables] })
})

test('a word that merely starts like a command is not that command', () => {
  assert.deepEqual(parse('/tabx foo'), { mode: 'search', provider: web, query: '/tabx foo' })
})

test('an unknown slash is searched for as typed, never swallowed', () => {
  assert.deepEqual(parse('/usr/bin'), { mode: 'search', provider: web, query: '/usr/bin' })
  assert.deepEqual(parse('/nope something'), { mode: 'search', provider: web, query: '/nope something' })
})

test('sources without a trigger are never offered as commands', () => {
  assert.deepEqual(parse('/', [web]), { mode: 'search', provider: web, query: '/' })
})

test('things that are clearly addresses are recognised', () => {
  for (const text of [
    'github.com',
    'GitHub.com/acme/api?tab=issues',
    'https://example.org/a b'.replace(' ', '%20'),
    'http://localhost:3000',
    'localhost',
    'localhost:8080/admin',
    '192.168.0.1',
    '10.0.0.1:8080/x',
    'www.example.co.uk',
    'docs.python.org',
    'my-site.dev',
  ]) {
    assert.equal(looksLikeUrl(text), true, text)
  }
})

test('ordinary words, files and sentences are not addresses', () => {
  for (const text of [
    '',
    '   ',
    'hello',
    'hello world',
    'how to center a div.com',
    'file.py',
    'main.rs',
    'index.ts',
    'e.g',
    'a@b.com',
    'ftp://x.com',
    'foo.invalidtld',
  ]) {
    assert.equal(looksLikeUrl(text), false, text)
  }
})

test('addresses without a scheme get one, plain http for local servers', () => {
  assert.equal(toUrl('github.com/acme'), 'https://github.com/acme')
  assert.equal(toUrl('  www.example.com '), 'https://www.example.com')
  assert.equal(toUrl('localhost:3000'), 'http://localhost:3000')
  assert.equal(toUrl('192.168.0.1/admin'), 'http://192.168.0.1/admin')
  assert.equal(toUrl('HTTPS://Example.com/A'), 'HTTPS://Example.com/A')
  assert.equal(toUrl('http://example.com'), 'http://example.com')
})
