import { describe, expect, it } from 'vitest'
import { boardId, periodKey, teamEntryId, validModeResult } from './leaderboards'

describe('Firebase ranking partitions', () => {
  it('separates solo, team sizes, difficulties and periods', () => {
    const date = new Date('2026-10-16T04:00:00Z')
    expect(boardId('solo', 'normal', 'day', date)).toBe('solo_normal_1_day_2026-10-15')
    expect(boardId('coop', 'hard', 'all', date, 4)).toBe('coop_hard_4_all_all')
    expect(periodKey('week', date)).toBe('2026-10-12')
    expect(periodKey('day', new Date('2026-10-16T06:00:00Z'))).toBe('2026-10-16')
  })
  it('keeps the same team record independent of order', () => {
    expect(teamEntryId(['b', 'a', 'b'])).toBe(teamEntryId(['a', 'b']))
  })
  it('allows versus victories before the solo boss, with the same bounds', () => {
    const result = { starter: 'charmander' as const, stage: 0, difficulty: 'normal' as const, outcome: 'victory' as const, time: 5, level: 1, kills: 0, version: 'test' }
    expect(validModeResult('versus', result)).toBe(true)
    expect(validModeResult('solo', result)).toBe(false)
    expect(validModeResult('versus', { ...result, time: -1 })).toBe(false)
    expect(validModeResult('versus', { ...result, kills: 10000 })).toBe(false)
  })
})
