import type { BoardPeriod, RunResult } from './ranking'
import type { Difficulty } from './difficulty'
import { parseRunResult } from './ranking'
import { PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'

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
/** The Pokémon a team played: one per trainer, in `team` order, in the form each ended in. */
export type Lineup = Array<{ starter: PlayableId; stage: number }>
/** A lineup read from a stored entry: unknown Pokémon and out-of-range stages are dropped (at most four). */
export const parseLineup = (raw: unknown): Lineup => Array.isArray(raw)
  ? raw.slice(0, 4).flatMap((item): Lineup => {
    const starter = typeof item?.starter === 'string' ? PLAYABLE_IDS.find((id) => id === item.starter) : undefined
    const stage = typeof item?.stage === 'number' ? Math.min(2, Math.max(0, Math.floor(item.stage))) : 0
    return starter ? [{ starter, stage }] : []
  })
  : []
export type ScoreEntry = RunResult & { lineup?: Lineup; runId: string; uid: string; name: string; handle: string; team: string[]; names: string[]; score: number; wins: number; at: string; verified: boolean }
export const compareScores = (a: ScoreEntry, b: ScoreEntry) => b.score - a.score || b.kills - a.kills || a.at.localeCompare(b.at)
/** A versus victory can happen before the solo boss appears. */
export const validModeResult = (mode: RankingMode, result: RunResult) => !!parseRunResult(mode === 'versus' ? { ...result, outcome: 'death' } : result)
