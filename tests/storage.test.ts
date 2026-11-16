import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SETTINGS, parseConfig } from '../src/lib/storage.ts'

test('a config saved before the new tab page existed gets its defaults', () => {
  const old = { version: 1, onboarded: true, groups: [], settings: { autoOrganize: false } }
  const { settings } = parseConfig(old)
  assert.equal(settings.autoOrganize, false)
  assert.equal(settings.userName, DEFAULT_SETTINGS.userName)
  assert.equal(settings.clock, 'auto')
  assert.equal(settings.scene, 'auto')
  assert.equal(settings.mergeDuplicates, true)
})

test('the new tab settings survive a round trip', () => {
  const saved = { settings: { userName: 'Robin', clock: '24h', scene: 'night' } }
  const { settings } = parseConfig(saved)
  assert.equal(settings.userName, 'Robin')
  assert.equal(settings.clock, '24h')
  assert.equal(settings.scene, 'night')
})

test('hand-edited nonsense falls back instead of reaching the page', () => {
  const { settings } = parseConfig({ settings: { userName: 42, clock: '36h', scene: 'dawn' } })
  assert.equal(settings.userName, '')
  assert.equal(settings.clock, 'auto')
  assert.equal(settings.scene, 'auto')
})

test('a group with no name stays nameless instead of becoming "Untitled"', () => {
  const { groups } = parseConfig({ groups: [{ name: '' }, { name: '  Work  ' }, {}] })
  assert.deepEqual(groups.map((group) => group.name), ['', 'Work', ''])
})
