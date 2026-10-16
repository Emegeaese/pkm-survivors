import type { BoardPeriod, RunResult } from './ranking'
import type { Difficulty } from './difficulty'
import { parseRunResult } from './ranking'

export type RankingMode = 'solo' | 'coop' | 'versus'
export const periodKey = (period: BoardPeriod, date: Date) => {
  if (period === 'all') return 'all'
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = (key: string) => Number(parts.find((p) => p.type === key)?.value)
  const day = new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
  if (period === 'week') day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
  return day.toISOString().slice(0, 10)
}
export const boardId = (mode: RankingMode, difficulty: Difficulty, period: BoardPeriod, date: Date, teamSize = 1) => `${mode}_${difficulty}_${mode === 'coop' ? teamSize : 1}_${period}_${periodKey(period, date)}`
export const teamEntryId = (ids: readonly string[]) => [...new Set(ids)].sort().join('_')
export type ScoreEntry = RunResult & { runId: string; uid: string; name: string; handle: string; team: string[]; names: string[]; score: number; wins: number; at: string; verified: boolean }
export const compareScores = (a: ScoreEntry, b: ScoreEntry) => b.score - a.score || b.kills - a.kills || a.at.localeCompare(b.at)
/** A versus victory can happen before the solo boss appears. */
export const validModeResult = (mode: RankingMode, result: RunResult) => !!parseRunResult(mode === 'versus' ? { ...result, outcome: 'death' } : result)
