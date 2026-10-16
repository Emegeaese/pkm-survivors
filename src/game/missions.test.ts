import { describe, expect, it } from 'vitest'
import { MISSION_SLOTS } from '../data/missions'
import { dayKey, drawMissions, goalValue, missionStatus, NO_MISSIONS, parseMissions, periodEnd, periodKey, recordHatchMissions, recordMissions, type Mission } from './missions'
import { bagCount } from './bag'
import { EMPTY_SAVE, recordRun } from './meta'
import { summary } from './tally.fixture'

/** Local time, like the player's clock. Months are 1-based here. */
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

const ids = (missions: Mission[]) => missions.map((m) => m.id)

/** First day of October 2026 whose dailies include a mission of `kind`. */
const dayWith = (kind: Mission['goal']['kind']) => {
  for (let d = 1; d <= 31; d++) {
    const date = at(2026, 10, d)
    const mission = drawMissions('daily', date).find((m) => m.goal.kind === kind)
    if (mission) return { date, mission }
  }
  throw new Error(`no ${kind} mission in October`)
}

describe('mission draw', () => {
  it('gives the same missions all day and new ones after local midnight', () => {
    expect(ids(drawMissions('daily', at(2026, 10, 13, 0, 0)))).toEqual(ids(drawMissions('daily', at(2026, 10, 13, 23, 59))))
    expect(dayKey(at(2026, 10, 13, 23, 59))).toBe('2026-10-13')
    expect(dayKey(at(2026, 10, 14, 0, 0))).toBe('2026-10-14')
    // Over a month, the days don't all repeat the same set.
    const sets = new Set(Array.from({ length: 30 }, (_, d) => ids(drawMissions('daily', at(2026, 10, d + 1))).join()))
    expect(sets.size).toBeGreaterThan(20)
  })

  it('draws the original missions and always adds cooperative and versus ticket goals', () => {
    const daily = drawMissions('daily', at(2026, 10, 13))
    expect(daily.filter((m) => !m.tickets)).toHaveLength(MISSION_SLOTS.daily)
    expect(daily.filter((m) => m.tickets)).toHaveLength(4)
    expect(drawMissions('weekly', at(2026, 10, 13)).filter((m) => !m.tickets)).toHaveLength(MISSION_SLOTS.weekly)
    expect(drawMissions('weekly', at(2026, 10, 13)).filter((m) => m.tickets)).toHaveLength(2)
    expect(new Set(daily.map((m) => m.goal.kind)).size).toBe(daily.length)
  })

  it('keeps the week from Monday 00:00 to Sunday 23:59, across months', () => {
    // 2026-10-26 is a Monday; Sunday 2026-11-01 ends that week.
    const week = periodKey('weekly', at(2026, 10, 26, 0, 0))
    expect(week).toBe('2026-10-26')
    expect(periodKey('weekly', at(2026, 11, 1, 23, 59))).toBe(week)
    expect(periodKey('weekly', at(2026, 10, 25, 23, 59))).toBe('2026-10-19')
    expect(periodKey('weekly', at(2026, 11, 2, 0, 0))).toBe('2026-11-02')
    expect(ids(drawMissions('weekly', at(2026, 10, 26, 0, 0)))).toEqual(ids(drawMissions('weekly', at(2026, 11, 1, 23, 59))))
  })

  it('knows when each period ends', () => {
    expect(periodEnd('daily', at(2026, 10, 31, 18))).toEqual(at(2026, 11, 1, 0))
    expect(periodEnd('weekly', at(2026, 10, 29, 18))).toEqual(at(2026, 11, 2, 0))
  })
})

describe('mission progress', () => {
  it('pays multiplayer mission tickets once, keeps modes separate and rejects quick versus farming', () => {
    const date = at(2026, 10, 16)
    const coop = summary({ time: 300, online: { mode: 'coop', finished: true, won: false, revivals: 1 } })
    const first = recordRun(EMPTY_SAVE, coop, null, date)
    expect(first.completed.filter((m) => m.tickets).map((m) => m.goal.kind)).toEqual(['coopMinutes', 'coopRevivals'])
    expect(first.save.gacha.earned - EMPTY_SAVE.gacha.earned).toBe(6) // 2 for time, 4 for missions.
    const repeated = recordRun(first.save, coop, coop, date)
    expect(repeated.save.gacha.earned).toBe(first.save.gacha.earned)
    expect(repeated.save.achievements.lifetime.coopRevivals).toBe(1)
    expect(first.save.achievements.unlocked).toContain('coopFirst')
    const quick = summary({ time: 10, online: { mode: 'versus', finished: true, won: true, revivals: 0 } })
    const rejected = recordRun(first.save, quick, null, date)
    expect(rejected.completed.filter((m) => m.tickets)).toHaveLength(0)
    expect(rejected.save.achievements.lifetime.versusRuns).toBe(0)
    expect(rejected.save.gacha.earned).toBe(first.save.gacha.earned)
    const duel = summary({ time: 65, online: { mode: 'versus', finished: true, won: true, revivals: 0 } })
    const won = recordRun(rejected.save, duel, null, date)
    expect(won.save.gacha.earned - rejected.save.gacha.earned).toBe(5) // Participation, victory, daily win mission.
    expect(won.save.achievements.unlocked).toContain('versusFirst')
    expect(won.save.achievements.lifetime.coopRuns).toBe(1)
    expect(won.save.achievements.lifetime.versusWins).toBe(1)
  })
  it('adds runs up and pays a mission once, when it completes', () => {
    const { date, mission } = dayWith('kills')
    const first = recordMissions(NO_MISSIONS, summary({ kills: mission.target - 10 }), null, date)
    expect(first.completed).toEqual([])
    expect(first.missions.daily.progress[mission.id]).toBe(mission.target - 10)
    const second = recordMissions(first.missions, summary({ kills: 50 }), null, date)
    expect(second.completed.map((m) => m.id)).toContain(mission.id)
    expect(second.missions.daily.progress[mission.id]).toBe(mission.target)
    expect(recordMissions(second.missions, summary({ kills: 999 }), null, date).completed).toEqual([])
  })

  it("counts the day's outbreak defeated, and pays its item into the bag", () => {
    const { date, mission } = dayWith('outbreakKills')
    expect(mission.item).toBe('lure')
    expect(goalValue(mission.goal, summary({ kills: 900, outbreakKills: 240 }))).toBe(240)
    const run = summary({ outbreakKills: mission.target })
    const record = recordRun({ ...EMPTY_SAVE }, run, null, date)
    expect(record.items).toContain('lure')
    expect(bagCount(record.save.bag, 'lure')).toBeGreaterThanOrEqual(1)
  })

  it('counts only what changed since the snapshot already recorded for the same run', () => {
    const { date, mission } = dayWith('kills')
    const atVictory = summary({ kills: 100, victory: true })
    const once = recordMissions(NO_MISSIONS, atVictory, null, date).missions
    expect(recordMissions(once, atVictory, atVictory, date).missions).toEqual(once)
    const later = recordMissions(once, summary({ kills: 130, victory: true }), atVictory, date).missions
    expect(later.daily.progress[mission.id]).toBe(130)
  })

  it('keeps the best single run for survival goals', () => {
    const { date, mission } = dayWith('survive')
    const type = mission.goal.kind === 'survive' ? mission.goal.type : undefined
    const starter = type === 'grass' ? 'bulbasaur' : type === 'water' ? 'squirtle' : 'charmander'
    const long = recordMissions(NO_MISSIONS, summary({ starter, time: 4 * 60 + 30 }), null, date).missions
    const short = recordMissions(long, summary({ starter, time: 2 * 60 }), null, date).missions
    expect(short.daily.progress[mission.id]).toBe(4)
    // A starter of another type doesn't count.
    const other = starter === 'charmander' ? 'squirtle' : 'charmander'
    expect(goalValue(mission.goal, summary({ starter: other, time: 900 }))).toBe(0)
  })

  it('starts over on a new day and shows progress capped at the target', () => {
    const { date, mission } = dayWith('kills')
    const done = recordMissions(NO_MISSIONS, summary({ kills: 99_999 }), null, date).missions
    expect(missionStatus(done, date).find((m) => m.id === mission.id)).toMatchObject({ progress: mission.target, done: true })
    const tomorrow = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    expect(missionStatus(done, tomorrow).filter((m) => m.period === 'daily').every((m) => m.progress === 0)).toBe(true)
  })

  it('counts hatched eggs outside runs, and only for hatch goals', () => {
    const date = Array.from({ length: 20 }, (_, w) => at(2026, 10, 5 + w * 7)).find((d) => drawMissions('weekly', d).some((m) => m.goal.kind === 'hatches'))!
    const mission = drawMissions('weekly', date).find((m) => m.goal.kind === 'hatches')!
    expect(mission.egg).toBe('common')
    expect(recordMissions(NO_MISSIONS, summary({ kills: 50, steps: 900 }), null, date).missions.weekly.progress[mission.id]).toBeUndefined()
    const hatched = recordHatchMissions(NO_MISSIONS, date)
    expect(hatched.missions.weekly.progress[mission.id]).toBe(1)
    expect(Object.keys(hatched.missions.weekly.progress)).toEqual([mission.id])
    expect(hatched.completed.map((m) => m.id)).toEqual(mission.target === 1 ? [mission.id] : [])
  })

  it('parses boards field by field', () => {
    expect(parseMissions(undefined)).toEqual(NO_MISSIONS)
    expect(parseMissions({ daily: { key: '2026-10-13', progress: { 'kills:500': 12.7, bad: 'x' } }, weekly: 3 })).toEqual({
      daily: { key: '2026-10-13', progress: { 'kills:500': 12, bad: 0 } },
      weekly: NO_MISSIONS.weekly,
    })
  })
})
