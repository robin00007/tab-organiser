import { test } from 'node:test'
import assert from 'node:assert/strict'
import { draftProblem, finalizeDraft } from '../src/lib/draft.ts'
import { makeGroup, makeRule } from '../src/lib/storage.ts'

const group = (name: string, ...values: string[]) =>
  makeGroup({ name, rules: values.map((value) => makeRule({ value })) })

test('a new group can only be saved with a name and a usable rule', () => {
  assert.equal(draftProblem(group('', 'youtube.com')), 'Give the group a name.')
  assert.equal(draftProblem(group('  ', 'youtube.com')), 'Give the group a name.')
  assert.equal(draftProblem(group('Video')), 'Add at least one rule.')
  assert.equal(draftProblem(group('Video', '', '  ')), 'Add at least one rule.')
  assert.equal(draftProblem(group('Video', 'youtube.com')), null)
  const badRegex = makeGroup({ name: 'Video', rules: [makeRule({ kind: 'regex', value: '(' })] })
  assert.equal(draftProblem(badRegex), 'Fix the rule marked in red.')
})

test('saving trims the name and drops blank rule rows', () => {
  const saved = finalizeDraft(group('  Video ', 'youtube.com', '', 'netflix.com'))
  assert.equal(saved.name, 'Video')
  assert.deepEqual(saved.rules.map((rule) => rule.value), ['youtube.com', 'netflix.com'])
})
