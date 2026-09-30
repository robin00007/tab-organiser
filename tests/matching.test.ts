import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  findGroupForTab,
  findMatchForTab,
  hostOf,
  isOrganizable,
  isValidRule,
  normalizeRuleValue,
  rankMatchesForTab,
  ruleMatches,
  ruleScore,
} from '../src/lib/matching.ts'
import type { Group, MatchKind, Rule } from '../src/lib/types.ts'

let seq = 0
const rule = (kind: MatchKind, value: string, enabled = true): Rule => ({
  id: `r${seq++}`,
  kind,
  value,
  enabled,
})

const group = (name: string, rules: Rule[], enabled = true): Group => ({
  id: `g-${name}`,
  name,
  color: 'blue',
  rules,
  enabled,
  collapse: false,
})

test('browser-internal and blank pages are never organisable', () => {
  for (const url of [
    'chrome://extensions',
    'chrome-extension://abc/options.html',
    'about:blank',
    'devtools://devtools/bundled/x.html',
    'file:///Users/me/notes.txt',
    'view-source:https://example.com',
    undefined,
    '',
  ]) {
    assert.equal(isOrganizable(url), false, `${url} should be skipped`)
  }
  assert.equal(isOrganizable('https://example.com'), true)
  assert.equal(isOrganizable('http://localhost:3000/'), true)
})

test('hostOf strips www and lowercases', () => {
  assert.equal(hostOf('https://WWW.Example.COM/path?q=1'), 'example.com')
  assert.equal(hostOf('not a url'), '')
})

test('domain values normalize away scheme, www, port and path', () => {
  assert.equal(normalizeRuleValue('domain', ' https://WWW.YouTube.com:443/watch?v=1 '), 'youtube.com')
  assert.equal(normalizeRuleValue('domain', 'github.com'), 'github.com')
})

test('domain rules match subdomains but not suffix lookalikes', () => {
  const r = rule('domain', 'github.com')
  assert.equal(ruleMatches(r, { url: 'https://github.com/me' }), true)
  assert.equal(ruleMatches(r, { url: 'https://gist.github.com/me' }), true)
  assert.equal(ruleMatches(r, { url: 'https://www.github.com/me' }), true)
  assert.equal(ruleMatches(r, { url: 'https://notgithub.com/me' }), false)
  assert.equal(ruleMatches(r, { url: 'https://github.com.evil.io/' }), false)
})

test('prefix rules work with and without a scheme', () => {
  const withScheme = rule('prefix', 'https://github.com/myorg/')
  const withoutScheme = rule('prefix', 'github.com/myorg/')
  for (const r of [withScheme, withoutScheme]) {
    assert.equal(ruleMatches(r, { url: 'https://github.com/myorg/repo' }), true)
    assert.equal(ruleMatches(r, { url: 'https://github.com/other/repo' }), false)
  }
})

test('keyword rules look at the title as well as the URL', () => {
  const r = rule('keyword', 'invoice')
  assert.equal(ruleMatches(r, { url: 'https://example.com/billing', title: 'March Invoice' }), true)
  assert.equal(ruleMatches(r, { url: 'https://example.com/invoice/12' }), true)
  assert.equal(ruleMatches(r, { url: 'https://example.com/other', title: 'Receipt' }), false)
})

test('a malformed regex is skipped rather than thrown', () => {
  const broken = rule('regex', '([')
  assert.equal(isValidRule(broken), false)
  assert.equal(ruleMatches(broken, { url: 'https://example.com' }), false)

  const good = rule('regex', String.raw`^https://.*\.atlassian\.net/browse/`)
  assert.equal(isValidRule(good), true)
  assert.equal(ruleMatches(good, { url: 'https://acme.atlassian.net/browse/AB-1' }), true)
  assert.equal(ruleMatches(good, { url: 'https://acme.atlassian.net/wiki' }), false)
})

test('a muted rule and a disabled group both stop matching', () => {
  assert.equal(ruleMatches(rule('domain', 'x.com', false), { url: 'https://x.com' }), false)
  const groups = [group('Social', [rule('domain', 'x.com')], false)]
  assert.equal(findGroupForTab(groups, { url: 'https://x.com' }), null)
})

test('a specific rule beats a broad one, whatever the group order', () => {
  const groups = [
    group('Dev', [rule('domain', 'github.com')]),
    group('Work', [rule('prefix', 'https://github.com/acme/')]),
  ]
  assert.equal(findGroupForTab(groups, { url: 'https://github.com/acme/api' })?.name, 'Work')
  assert.equal(findGroupForTab(groups, { url: 'https://github.com/someone/else' })?.name, 'Dev')
  assert.equal(findGroupForTab(groups, { url: 'https://example.com' }), null)
})

test('the same domain in two groups goes to the one whose URL matches deeper', () => {
  const groups = [
    group('Social', [rule('domain', 'instagram.com')]),
    group('Content creation', [rule('prefix', 'https://www.instagram.com/robin0007')]),
  ]
  const profile = findMatchForTab(groups, { url: 'https://www.instagram.com/robin0007/reels/' })
  assert.equal(profile?.group.name, 'Content creation')
  assert.equal(profile?.rule.value, 'https://www.instagram.com/robin0007')

  // Anything else on the same host still belongs to the broad group.
  assert.equal(findGroupForTab(groups, { url: 'https://www.instagram.com/explore/' })?.name, 'Social')
})

test('order still settles groups that match equally well', () => {
  const rules = [rule('domain', 'instagram.com')]
  const first = group('Social', rules)
  const second = group('Content creation', [rule('domain', 'instagram.com')])
  assert.equal(findGroupForTab([first, second], { url: 'https://instagram.com/' })?.name, 'Social')
  assert.equal(findGroupForTab([second, first], { url: 'https://instagram.com/' })?.name, 'Content creation')
})

test('a group is judged on its best rule, not its first', () => {
  const groups = [
    group('Social', [rule('domain', 'instagram.com')]),
    group('Work', [rule('domain', 'example.com'), rule('prefix', 'instagram.com/company/acme')]),
  ]
  assert.equal(findGroupForTab(groups, { url: 'https://instagram.com/company/acme' })?.name, 'Work')
})

test('scores count the characters of the URL a rule pins down', () => {
  const url = 'https://www.instagram.com/robin0007'
  assert.equal(ruleScore(rule('domain', 'instagram.com'), { url }), 'instagram.com'.length)
  // The scheme is not counted, so typing it or leaving it out scores the same.
  assert.equal(ruleScore(rule('prefix', 'https://www.instagram.com/'), { url }), 'www.instagram.com/'.length)
  assert.equal(ruleScore(rule('prefix', 'www.instagram.com/'), { url }), 'www.instagram.com/'.length)
  assert.equal(ruleScore(rule('keyword', 'robin0007'), { url }), 'robin0007'.length)
  // A regex is measured by how much of the URL it consumed.
  assert.equal(ruleScore(rule('regex', String.raw`instagram\.com/robin\d+`), { url }), 'instagram.com/robin0007'.length)
  assert.equal(ruleScore(rule('domain', 'facebook.com'), { url }), null)
})

test('a rule that pins down nothing still matches but never outranks', () => {
  const groups = [
    group('Everything', [rule('prefix', 'https://')]),
    group('Social', [rule('domain', 'instagram.com')]),
  ]
  assert.equal(ruleScore(rule('prefix', 'https://'), { url: 'https://instagram.com/' }), 0)
  assert.equal(findGroupForTab(groups, { url: 'https://instagram.com/' })?.name, 'Social')
  assert.equal(findGroupForTab(groups, { url: 'https://example.com/' })?.name, 'Everything')
})

test('rankMatchesForTab lists every claimant, most specific first', () => {
  const groups = [
    group('Social', [rule('domain', 'instagram.com')]),
    group('Content creation', [rule('prefix', 'https://www.instagram.com/robin0007')]),
    group('Work', [rule('domain', 'example.com')]),
  ]
  const ranked = rankMatchesForTab(groups, { url: 'https://www.instagram.com/robin0007' })
  assert.deepEqual(ranked.map((match) => match.group.name), ['Content creation', 'Social'])
  assert.deepEqual(rankMatchesForTab(groups, { url: 'chrome://extensions' }), [])
})

test('empty rule values never match everything', () => {
  for (const kind of ['domain', 'prefix', 'keyword', 'regex'] as const) {
    assert.equal(ruleMatches(rule(kind, '   '), { url: 'https://example.com' }), false, kind)
  }
})

test('an unnamed group is skipped — Chrome groups are re-found by title', () => {
  const groups = [group('  ', [rule('domain', 'x.com')]), group('Social', [rule('domain', 'x.com')])]
  assert.equal(findGroupForTab(groups, { url: 'https://x.com' })?.name, 'Social')
})
