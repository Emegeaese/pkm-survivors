import { describe, expect, it } from 'vitest'
import { createMatch, matchCommand, matchHash, REVIVE_SECONDS, selectMember, spectatorTarget, stepMatch, type Match, type Trainer } from './multiplayer'
import { spawnEnemy } from './enemies'
import { dropXp } from './pickups'
import { dropMegaStones, grantStone } from './mega'

const trainers: Trainer[] = [
  { id: 'ash', name: 'Ash', starter: 'charmander', shiny: false },
  { id: 'misty', name: 'Misty', starter: 'squirtle', shiny: false },
]
const choose = (m: Match) => m.members.filter((p) => p.state.phase === 'levelup').map((p) => ({ id: p.trainer.id, kind: 'pick' as const, index: 0 }))

describe('shared multiplayer simulation', () => {
  it('spectates living trainers, switches targets after death and restores the local camera after revival', () => {
    const m = createMatch([...trainers, { ...trainers[0]!, id: 'brock', name: 'Brock' }], 'coop', 1)
    expect(spectatorTarget(m, 'ash', null)?.trainer.id).toBe('ash')
    m.members[0]!.state.player.hp = 0
    const checksum = matchHash(m)
    expect(spectatorTarget(m, 'ash', null)?.trainer.id).toBe('misty')
    expect(spectatorTarget(m, 'ash', 'misty', 1)?.trainer.id).toBe('brock')
    expect(spectatorTarget(m, 'ash', 'misty', -1)?.trainer.id).toBe('brock')
    expect(matchHash(m)).toBe(checksum)
    m.members[1]!.connected = false
    expect(spectatorTarget(m, 'ash', 'misty')?.trainer.id).toBe('brock')
    m.members[0]!.state.player.hp = 1
    expect(spectatorTarget(m, 'ash', 'brock')?.trainer.id).toBe('ash')
    m.members.forEach((p) => { p.state.player.hp = 0 })
    expect(spectatorTarget(m, 'ash', 'brock')?.trainer.id).toBe('ash')
  })
  it('resets interrupted revive progress and credits the rescuing trainer exactly once', () => {
    const m = createMatch(trainers, 'coop', 1)
    m.game.spawnBudget = -100000
    const [a, b] = m.members
    b!.state.player.hp = 0; b!.state.phase = 'gameover'
    for (let i = 0; i < 120; i++) stepMatch(m, {})
    expect(b!.revive).toBeGreaterThan(1)
    expect(b!.revive).toBeLessThan(REVIVE_SECONDS)
    a!.state.player.x = 1000; stepMatch(m, {})
    expect(b!.revive).toBe(0); expect(a!.revivals).toBe(0)
    a!.state.player.x = b!.state.player.x
    for (let i = 0; i < 310; i++) stepMatch(m, {}, choose(m))
    expect(b!.state.player.hp).toBeGreaterThan(0)
    expect(b!.revive).toBe(0); expect(a!.revivals).toBe(1)
  })
  it('splits the horde between trainers instead of sending it all to one', () => {
    const m = createMatch(trainers, 'coop', 7)
    const [a, b] = m.members
    a!.state.player.x = 0; b!.state.player.x = 400
    for (let i = 0; i < 1500; i++) stepMatch(m, {}, choose(m))
    const chasers = m.game.enemies.filter((e) => !e.boss && e.dying < 0 && e.target)
    const mine = chasers.filter((e) => e.target === a!.state.player).length
    expect(chasers.length).toBeGreaterThan(10)
    expect(Math.abs(mine - (chasers.length - mine))).toBeLessThanOrEqual(Math.ceil(chasers.length * 0.4))
    expect(chasers.some((e) => e.target === b!.state.player)).toBe(true)
  })
  it('reproduces the same world, upgrades and checksums on independent clients', () => {
    const a = createMatch(trainers, 'coop', 125), b = createMatch(trainers, 'coop', 125)
    for (let tick = 0; tick < 600; tick++) {
      const inputs = { ash: { move: { x: tick < 100 ? 1 : 0, y: 0 }, special: tick % 100 === 0 }, misty: { move: { x: 0, y: tick < 120 ? 1 : 0 }, special: tick % 110 === 0 } }
      stepMatch(a, inputs, choose(a)); stepMatch(b, inputs, choose(b))
      if (tick % 60 === 0) expect(matchHash(a)).toBe(matchHash(b))
      // Local camera, selected member and viewport are presentation only.
      selectMember(b, tick % 2 ? 'ash' : 'misty')
    }
    expect(a.game.time).toBeGreaterThan(0)
    expect(a.members[0]!.state.player.x).not.toBe(a.members[1]!.state.player.x)
    expect(matchHash(a)).toBe(matchHash(b))
  })
  it('shares collected XP and pauses the world until all upgrade choices resolve', () => {
    const m = createMatch(trainers, 'coop', 4)
    m.game.spawnBudget = -10000
    dropXp(m.game, 0, -6, 40)
    m.game.pickups[0]!.attracted = true
    stepMatch(m, {})
    expect(m.members.map((p) => p.state.player.level)).toEqual([3, 3])
    const time = m.game.time
    stepMatch(m, {})
    expect(m.game.time).toBe(time)
    for (let i = 0; i < 4; i++) stepMatch(m, {}, choose(m))
    expect(m.members.every((p) => p.state.phase === 'playing')).toBe(true)
  })
  it('lets teammates hit the same enemy and revives a fallen trainer nearby', () => {
    const m = createMatch(trainers, 'coop', 2)
    m.game.spawnBudget = -10000
    const enemy = spawnEnemy(m.game, 'snorlax', 32, 0)
    const hp = enemy.hp
    for (let i = 0; i < 90; i++) stepMatch(m, {})
    expect(enemy.hp).toBeLessThan(hp * 1.55)
    m.members[1]!.state.player.hp = 0; m.members[1]!.state.phase = 'gameover'
    m.game.enemies = []
    m.members[0]!.state.player.x = m.members[1]!.state.player.x
    m.members[0]!.state.player.y = m.members[1]!.state.player.y
    for (let i = 0; i < 310; i++) stepMatch(m, {}, choose(m))
    expect(m.members[1]!.state.player.hp).toBeGreaterThan(0)
    expect(m.result).toBeNull()
  })
  it('moves the full team into a legendary rift and preserves individual builds', () => {
    const m = createMatch(trainers, 'coop', 2)
    const p = m.game.rift.portal = { legend: 'kyogre', x: 0, y: 0, left: 99, charge: 999 }
    m.members.forEach((p) => { p.state.player.x = 0; p.state.player.y = 0 })
    stepMatch(m, {})
    expect(m.game.rift.arena?.legend).toBe(p.legend)
    expect(Math.abs(m.members[0]!.state.player.x - m.members[1]!.state.player.x)).toBeLessThan(50)
    expect(m.members.map((p) => p.state.starter)).toEqual(['charmander', 'squirtle'])
  })
  it('uses a team pause in coop and allows versus attacks to damage another trainer', () => {
    const coop = createMatch(trainers, 'coop', 1)
    matchCommand(coop, { id: 'ash', kind: 'pause' }); stepMatch(coop, {})
    expect(coop.game.time).toBe(0)
    const versus = createMatch(trainers, 'versus', 1)
    matchCommand(versus, { id: 'ash', kind: 'pause' }); expect(versus.paused).toBe(false)
    const a = versus.members[0]!.state.player, b = versus.members[1]!.state.player
    a.x = -15; a.y = 0; a.facing = { x: 1, y: 0 }; b.x = 15; b.y = 0; b.facing = { x: -1, y: 0 }
    const hp = a.hp + b.hp
    for (let i = 0; i < 120; i++) stepMatch(versus, {}, choose(versus))
    expect(a.hp + b.hp).toBeLessThan(hp)
    b.hp = 0; stepMatch(versus, {})
    expect(versus.result).toBe('ash')
  })
  it('lets the host continue a team victory into endless mode', () => {
    const m = createMatch(trainers, 'coop', 5)
    m.result = 'victory'; m.game.time = 900
    m.members[0]!.state.phase = 'victory'
    matchCommand(m, { id: 'misty', kind: 'endless' }); expect(m.result).toBe('victory')
    matchCommand(m, { id: 'ash', kind: 'endless' })
    expect(m.result).toBeNull(); expect(m.game.endless).not.toBeNull()
    expect(m.members.every((p) => p.state.phase === 'playing')).toBe(true)
  })
  it('keeps stones owned by other trainers when choosing a Mega form', () => {
    const m = createMatch(trainers, 'coop', 7)
    const a = selectMember(m, 'ash'); dropMegaStones(a, 0, 0)
    const b = selectMember(m, 'misty'); dropMegaStones(b, 20, 0)
    const own = selectMember(m, 'ash'); grantStone(own, 'charizardX')
    expect(m.game.pickups.filter((k) => k.kind === 'megaStone' && k.owner === 'misty').every((k) => k.age >= 0)).toBe(true)
    expect(m.game.pickups.filter((k) => k.kind === 'megaStone' && k.owner === 'misty')).toHaveLength(1)
  })
})
