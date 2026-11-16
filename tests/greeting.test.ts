import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clockParts, dateLine, greeting, msUntilNextMinute, timeOfDay } from '../src/lib/greeting.ts'

// Intl may separate the time from AM/PM with a narrow no-break space.
const plain = (text: string) => text.replace(/\s/g, ' ')

test('the day is cut at 5, 12, 17 and 21', () => {
  const expected = [
    [0, 'night'], [4, 'night'],
    [5, 'morning'], [11, 'morning'],
    [12, 'afternoon'], [16, 'afternoon'],
    [17, 'evening'], [20, 'evening'],
    [21, 'night'], [23, 'night'],
  ] as const
  for (const [hour, part] of expected) assert.equal(timeOfDay(hour), part, `${hour}h`)
})

test('the greeting follows the time of day and adds the name when there is one', () => {
  assert.equal(greeting(9, ''), 'Good morning')
  assert.equal(greeting(13, 'Robin'), 'Good afternoon, Robin')
  assert.equal(greeting(18, '  Robin  '), 'Good evening, Robin')
  assert.equal(greeting(2, '   '), 'Good night')
})

test('a 24-hour clock pads the hour and never prints 24', () => {
  assert.deepEqual(clockParts(new Date(2026, 10, 16, 9, 5), '24h', 'en-GB'), { time: '09:05', period: '' })
  assert.deepEqual(clockParts(new Date(2026, 10, 16, 0, 5), '24h', 'en-US'), { time: '00:05', period: '' })
  assert.deepEqual(clockParts(new Date(2026, 10, 16, 17, 30), '24h', 'en-US'), { time: '17:30', period: '' })
})

test('a 12-hour clock splits the AM/PM marker from the digits', () => {
  const morning = clockParts(new Date(2026, 10, 16, 9, 5), '12h', 'en-US')
  assert.equal(morning.time, '9:05')
  assert.equal(plain(morning.period), 'AM')

  const evening = clockParts(new Date(2026, 10, 16, 17, 30), '12h', 'en-US')
  assert.equal(evening.time, '5:30')
  assert.equal(plain(evening.period), 'PM')

  assert.equal(clockParts(new Date(2026, 10, 16, 0, 5), '12h', 'en-US').time, '12:05')
})

test('auto lets the locale decide', () => {
  assert.equal(clockParts(new Date(2026, 10, 16, 17, 30), 'auto', 'en-GB').period, '')
  assert.equal(plain(clockParts(new Date(2026, 10, 16, 17, 30), 'auto', 'en-US').period), 'PM')
})

test('the date line names the weekday, day and month', () => {
  const line = dateLine(new Date(2026, 10, 16), 'en-GB')
  for (const word of ['Monday', '16', 'November']) assert.ok(line.includes(word), line)
})

test('the clock re-ticks exactly when the minute changes', () => {
  const minute = 60_000 * 1234
  assert.equal(msUntilNextMinute(minute + 30_500), 29_500)
  assert.equal(msUntilNextMinute(minute + 59_999), 1)
  assert.equal(msUntilNextMinute(minute), 60_000)
})
