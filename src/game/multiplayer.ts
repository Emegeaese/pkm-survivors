import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { ENEMIES, type EnemyId } from '../data/enemies'
import { NO_RANKS } from './meta'
import { advancePhase, chooseOffer, createGame, updateEvolution, updateMoves, updatePlayer, type StepInput } from './game'
import { updateAttacks } from './attacks'
import { updateBiome } from './biomes'
import { touchHazards, updateBosses, updateHazards } from './bosses'
import { hurtPlayer } from './combat'
import { updateConsumables } from './consumables'
import { updateEffects } from './effects'
import { rebuildGrid, spawnEnemy, updateEnemies } from './enemies'
import { continueEndless, updateEndless } from './endlessSystem'
import { gainXp } from './leveling'
import { updateMapEvents } from './mapEvents'
import { dropMegaStones, updateMega, updateMegaIntro } from './mega'
import { updatePickups } from './pickups'
import { updateProps } from './props'
import { updateArena } from './riftArena'
import { updateRiftPortal } from './riftPortal'
import { updateSightings } from './sightings'
import { updateSpawner } from './spawner'
import { updateSpecial } from './special'
import { updateStatuses } from './statusSystem'
import { statusAttack, statusPace } from './status'
import { blockPlayer, updateTerrain } from './terrain'
import { updateTraits } from './traitSystem'
import { updateWeather } from './weather'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'

export const NETWORK_VERSION = 2
export type MatchMode = 'coop' | 'versus'
export type Trainer = { id: string; name: string; starter: PlayableId; shiny: boolean }
const PERSONAL = ['starter', 'player', 'special', 'mega', 'attacks', 'buffs', 'ranks', 'rerolls', 'skips', 'pendingLevelUps', 'offers', 'evolution', 'revives', 'phase', 'damageByMove', 'trainerId'] as const satisfies readonly (keyof Game)[]
type Personal = Pick<Game, (typeof PERSONAL)[number]>
export type Member = { trainer: Trainer; state: Personal; revive: number; revivals: number; connected: boolean }
export const REVIVE_SECONDS = 5
/** Presentation only: never selects a different simulation member or changes the match. */
export const spectatorTarget = (m: Match, self: string, current: string | null, direction = 0): Member | undefined => {
  const local = m.members.find((p) => p.trainer.id === self)
  if (local && alive(local)) return local
  const candidates = m.members.filter(alive)
  if (!candidates.length) return local
  const index = candidates.findIndex((p) => p.trainer.id === current)
  return candidates[index < 0 ? 0 : (index + direction + candidates.length) % candidates.length]
}
export type Match = { game: Game; members: Member[]; mode: MatchMode; paused: boolean; result: 'victory' | 'defeat' | string | null; tick: number; scaled: Set<number>; proxies: Map<string, Enemy> }
export type Command = { id: string; kind: 'pick'; index: number } | { id: string; kind: 'pause' | 'endless' | 'leave' }
const capture = (g: Game): Personal => Object.fromEntries(PERSONAL.map((k) => [k, g[k]])) as Personal

/** A single world/RNG with a separate loadout, health and evolution state for each trainer. */
export const createMatch = (trainers: Trainer[], mode: MatchMode, seed: number): Match => {
  if (trainers.length < 2 || trainers.length > 4 || new Set(trainers.map((t) => t.id)).size !== trainers.length || trainers.some((t) => !Object.hasOwn(PLAYABLE, t.starter))) throw new Error('Invalid team')
  const game = createGame(trainers[0]!.starter, { w: 480, h: 270 }, seed)
  game.partyXp = 0
  const members = trainers.map((trainer, i): Member => {
    const g = createGame(trainer.starter, { w: 480, h: 270 }, seed + i + 1, NO_RANKS, game.roster, { shiny: trainer.shiny })
    g.trainerId = trainer.id
    // Friends share fair starting upgrades in both modes.
    g.player.x = mode === 'coop' ? i * 24 : (i % 2 ? 120 : -120)
    g.player.y = mode === 'coop' ? 0 : (i < 2 ? -90 : 90)
    g.player.shiny = trainer.shiny; g.player.luckyShiny = false
    return { trainer, state: capture(g), revive: 0, revivals: 0, connected: true }
  })
  const m: Match = { game, members, mode, paused: false, result: null, tick: 0, scaled: new Set(), proxies: new Map() }
  selectMember(m, trainers[0]!.id)
  if (mode === 'versus') for (const member of members) {
    const def = Object.entries(ENEMIES).find(([, e]) => e.dex === PLAYABLE[member.trainer.starter].line[0].dex)
    const e = spawnEnemy(game, (def?.[0] ?? 'rattata') as EnemyId, member.state.player.x, member.state.player.y)
    e.id = -members.indexOf(member) - 1; e.hp = e.maxHp = 1e9; e.xp = 0; e.boss = false; e.trait.act = null
    e.types = PLAYABLE[member.trainer.starter].line[0].types
    m.proxies.set(member.trainer.id, e)
  }
  return m
}

export const selectMember = (m: Match, id: string) => {
  const member = m.members.find((p) => p.trainer.id === id) ?? m.members[0]!
  Object.assign(m.game, member.state)
  m.game.camera = { x: m.game.player.x - m.game.view.w / 2, y: m.game.player.y - 10 - m.game.view.h / 2 }
  return m.game
}
const asMember = (m: Match, member: Member, fn: (g: Game) => void) => {
  const g = selectMember(m, member.trainer.id)
  fn(g)
  if (g.phase === 'victory') m.result = 'victory'
  member.state = capture(g)
}
const idle: StepInput = { move: { x: 0, y: 0 }, special: false }
const alive = (m: Member) => m.connected && m.state.player.hp > 0
const distance2 = (a: { x: number; y: number }, b: { x: number; y: number }) => dm.sq(a.x - b.x) + dm.sq(a.y - b.y)

export const matchCommand = (m: Match, cmd: Command) => {
  const member = m.members.find((p) => p.trainer.id === cmd.id)
  if (!member) return
  if (cmd.kind === 'leave') { member.connected = false; member.state.player.hp = 0; member.state.phase = 'gameover'; return }
  if (cmd.kind === 'endless' && m.mode === 'coop' && m.result === 'victory' && m.members[0] === member) {
    m.result = null
    asMember(m, member, (g) => { g.phase = 'victory'; continueEndless(g) })
    for (const p of m.members) if (p.state.player.hp > 0) p.state.phase = 'playing'
    return
  }
  if (m.result || !alive(member)) return
  if (cmd.kind === 'pause' && m.mode === 'coop') m.paused = !m.paused
  if (cmd.kind === 'pick' && Number.isInteger(cmd.index) && member.state.phase === 'levelup') {
    const offer = member.state.offers[cmd.index]
    if (offer) asMember(m, member, (g) => chooseOffer(g, offer))
  }
}

const companionContact = (g: Game) => {
  for (const e of g.enemies) if (e.dying < 0 && distance2(e, g.player) < dm.sq(e.radius + g.player.radius)) {
    const attack = statusAttack(e.status)
    if (attack > 0) hurtPlayer(g, e.damage * attack, e)
  }
  touchHazards(g)
}

const applyVersusDamage = (m: Match, attacker: Member) => {
  for (const other of m.members) if (other !== attacker) {
    const e = m.proxies.get(other.trainer.id)!
    const raw = (1e9 - e.hp) * 0.4 * statusAttack(m.proxies.get(attacker.trainer.id)!.status)
    const damage = raw > 0 ? Math.max(1, Math.round(raw * other.state.player.stats.damageTaken - other.state.player.stats.armor)) : 0
    other.state.player.hp = Math.max(0, other.state.player.hp - damage)
    if (other.state.player.hp <= 0) other.state.phase = 'gameover'
    e.hp = 1e9
  }
}

/** Ordered network inputs drive the same fixed-size simulation on every client. */
export const stepMatch = (m: Match, inputs: Record<string, StepInput>, commands: Command[] = [], dt = 1 / 60) => {
  m.tick++
  for (const cmd of commands) matchCommand(m, cmd)
  if (m.result || m.paused) return
  const live = m.members.filter(alive)
  if (!live.length) { m.result = m.mode === 'coop' ? 'defeat' : 'draw'; return }
  if (m.mode === 'versus' && live.length === 1) { m.result = live[0]!.trainer.id; return }
  // Everyone sees the same pause while any trainer chooses or evolves.
  const evolving = live.filter((p) => p.state.phase === 'evolving' || p.state.mega.intro > 0)
  for (const p of evolving) asMember(m, p, (g) => { if (g.phase === 'evolving') updateEvolution(g, dt); else updateMegaIntro(g, dt) })
  if (evolving.length || live.some((p) => p.state.phase === 'levelup')) return
  const g = m.game
  if (g.hitstop > 0) { g.hitstop = Math.max(0, g.hitstop - dt); return }
  g.time += dt
  const leader = live[0]!
  g.partyTargets = live.map((p) => p.state.player)
  const arenaBefore = g.rift.arena
  const lootBefore = arenaBefore?.loot
  for (const p of live) asMember(m, p, (g) => {
    g.phase = 'playing'
    const input = inputs[p.trainer.id] ?? idle
    if (m.mode === 'versus') {
      g.enemies = live.filter((other) => other !== p).map((other) => {
        const e = m.proxies.get(other.trainer.id)!
        e.x = other.state.player.x; e.y = other.state.player.y; e.hp = 1e9
        return e
      })
      rebuildGrid(g)
    }
    const pace = m.mode === 'versus' ? statusPace(m.proxies.get(p.trainer.id)!.status) : 1
    updatePlayer(g, { x: input.move.x * pace, y: input.move.y * pace }, dt); updateMega(g, input.mega === true, dt); updateSpecial(g, input.special, dt)
    if (m.mode === 'versus') applyVersusDamage(m, p)
  })
  selectMember(m, leader.trainer.id)
  if (m.mode === 'coop') {
    if (!g.rift.arena) { updateBiome(g); updateWeather(g, dt); updateSpawner(g, dt) }
    for (const e of g.enemies) if (!m.scaled.has(e.id)) {
      const scale = 1 + (m.members.length - 1) * 0.55
      e.hp *= scale; e.maxHp *= scale; m.scaled.add(e.id)
    }
    rebuildGrid(g); updateEnemies(g, dt); updateBosses(g, dt); updateHazards(g, dt); updateStatuses(g, dt)
    leader.state = capture(g)
    const portal = g.rift.portal
    const activator = portal ? live.reduce((a, b) => distance2(a.state.player, portal) < distance2(b.state.player, portal) ? a : b) : leader
    asMember(m, activator, (g) => updateRiftPortal(g, dt))
    asMember(m, leader, (g) => { updateArena(g, dt); updateEndless(g); rebuildGrid(g); updateTraits(g, dt) })
  } else {
    for (const p of live) {
      const e = m.proxies.get(p.trainer.id)!
      e.x = p.state.player.x; e.y = p.state.player.y; e.radius = p.state.player.radius
      e.types = PLAYABLE[p.state.starter].line[p.state.player.stage]!.types
    }
  }
  // Rifts carry the whole team in and out; stale homing targets are cleared.
  if (g.rift.arena !== arenaBefore) {
    const anchor = { ...g.player }
    for (const [i, p] of live.entries()) {
      p.state.player.x = anchor.x + i * 12; p.state.player.y = anchor.y
      p.state.player.iframes = 1.5
      for (const a of p.state.attacks) if (a.motion.kind === 'homing') a.motion.target = null
    }
  }
  const collected = new Map<string, number>()
  const xpBefore = g.partyXp ?? 0
  for (const p of live) asMember(m, p, (g) => {
    if (p.state.player.hp <= 0) return
    g.phase = 'playing'
    if (m.mode === 'versus') {
      g.enemies = live.filter((other) => other !== p).map((other) => m.proxies.get(other.trainer.id)!)
      for (const e of g.enemies) e.hp = 1e9
      rebuildGrid(g)
      updateStatuses(g, dt / live.length)
    }
    updateMoves(g, inputs[p.trainer.id]?.lunge === true, dt); updateAttacks(g, dt)
    if (m.mode === 'versus') {
      applyVersusDamage(m, p)
      const radius = versusRadius(g.time), player = g.player
      if (distance2(player, { x: 0, y: 0 }) > dm.sq(radius)) player.hp = Math.max(0, player.hp - player.stats.maxHp * 0.12 * dt)
      if (g.time >= 180) player.hp = Math.max(0, player.hp - player.stats.maxHp * dt)
      blockPlayer(g)
      if (player.hp <= 0) g.phase = 'gameover'
      // Equal timed XP keeps upgrades and evolutions in versus.
      gainXp(g, dt * 5)
    } else {
      if (p !== leader) companionContact(g)
      if (g.player.hp > 0) {
        if (g.rift.arena) updateArena(g, 0)
        blockPlayer(g)
        if (!g.rift.arena) updateMapEvents(g, dt / live.length)
        const before = g.partyXp ?? 0
        updatePickups(g, dt / live.length)
        collected.set(p.trainer.id, (g.partyXp ?? 0) - before)
      }
    }
    updateConsumables(g, dt)
  })
  if (m.mode === 'coop') {
    if (g.rift.arena && g.rift.arena.loot !== null && lootBefore === null) for (const p of live) asMember(m, p, (g) => {
      if (!g.mega.stone && !g.pickups.some((k) => k.kind === 'megaStone' && k.owner === g.trainerId)) dropMegaStones(g, g.player.x, g.player.y - 10)
    })
    const total = (g.partyXp ?? 0) - xpBefore
    for (const p of live) asMember(m, p, (g) => {
      if (g.player.hp > 0) gainXp(g, total - (collected.get(p.trainer.id) ?? 0))
    })
    asMember(m, leader, (g) => {
      updateTerrain(g, dt)
      const attacks = g.attacks
      g.attacks = m.members.flatMap((p) => p.state.attacks)
      if (!g.rift.arena) updateProps(g, dt)
      g.attacks = attacks
      updateSightings(g, dt)
    })
    for (const p of m.members) {
      if (!p.connected || p.state.player.hp > 0) continue
      const close = m.members.some((other) => alive(other) && distance2(p.state.player, other.state.player) < dm.sq(40))
      p.revive = close ? p.revive + dt : 0
      if (p.revive >= REVIVE_SECONDS) {
        const rescuer = m.members.filter((other) => alive(other) && other !== p).sort((a, b) => distance2(a.state.player, p.state.player) - distance2(b.state.player, p.state.player))[0]
        if (rescuer) rescuer.revivals++
        p.state.player.hp = p.state.player.stats.maxHp * 0.4; p.state.player.iframes = 2; p.state.phase = 'playing'; p.revive = 0
      }
    }
  }
  for (const p of live) asMember(m, p, (g) => { if (g.phase === 'playing' && g.player.hp > 0) advancePhase(g) })
  updateEffects(g, dt)
  if (m.mode === 'versus') g.enemies = []
  selectMember(m, leader.trainer.id)
  if (m.result === null && !m.members.some(alive)) m.result = m.mode === 'coop' ? 'defeat' : 'draw'
}

export const versusRadius = (time: number) => Math.max(45, 220 - time)

/** Compact deterministic checksum; rendering and viewport never enter it. */
export const matchHash = (m: Match) => {
  const s = JSON.stringify([m.tick, m.game.time, m.result, m.members.map((p) => [p.state.player.x, p.state.player.y, p.state.player.hp, p.state.player.level, p.state.phase]), m.game.enemies.map((e) => [e.id, e.hp, e.x, e.y])])
  let hash = 2166136261
  for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619)
  return hash >>> 0
}
