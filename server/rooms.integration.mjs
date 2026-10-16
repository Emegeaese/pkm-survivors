import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { WebSocket } from 'ws'
import { createRoomServer } from './rooms.mjs'

const client = (url) => {
  const ws = new WebSocket(url), messages = [], waiters = []
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString()), i = waiters.findIndex((w) => w.type === msg.type)
    if (i >= 0) { const [w] = waiters.splice(i, 1); clearTimeout(w.timer); w.resolve(msg) } else messages.push(msg)
    if (msg.type === 'tick') ws.send(JSON.stringify({ type: 'ack', tick: msg.tick }))
  })
  ws.on('error', () => {})
  return { ws, send: (msg) => ws.send(JSON.stringify(msg)), next: (type) => {
    const i = messages.findIndex((m) => m.type === type)
    if (i >= 0) return Promise.resolve(messages.splice(i, 1)[0])
    return new Promise((resolve, reject) => { const waiter = { type, resolve, timer: setTimeout(() => reject(new Error(`Timed out: ${type}`)), 3000) }; waiters.push(waiter) })
  } }
}

test('real sockets: private room, version checks, normalized input, ordered ticks and disconnect cleanup', async () => {
  const app = createRoomServer()
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening')
  const url = `ws://127.0.0.1:${app.server.address().port}/rooms`
  const a = client(url), b = client(url), rejected = client(url)
  try {
    const [helloA, helloB] = await Promise.all([a.next('hello'), b.next('hello'), rejected.next('hello')])
    a.send({ type: 'create', name: 'Ash', starter: 'charmander', mode: 'coop', version: 'test' })
    const room = await a.next('lobby')
    rejected.send({ type: 'join', name: 'Old client', starter: 'squirtle', code: room.code, version: 'old' })
    assert.equal((await rejected.next('error')).type, 'error')
    b.send({ type: 'join', name: 'Misty', starter: 'squirtle', code: room.code, version: 'test' })
    await Promise.all([a.next('lobby'), b.next('lobby')])
    a.send({ type: 'ready', ready: true }); await Promise.all([a.next('lobby'), b.next('lobby')])
    b.send({ type: 'ready', ready: true }); await Promise.all([a.next('lobby'), b.next('lobby')])
    a.send({ type: 'start' }); const starts = await Promise.all([a.next('start'), b.next('start')])
    assert.deepEqual(starts[0], starts[1]); assert.equal(starts[0].players.length, 2)
    b.send({ type: 'input', move: { x: 500, y: 0 }, special: true })
    b.send({ type: 'command', kind: 'pick', id: helloA.id, index: 0 })
    let tick
    for (let i = 0; i < 5; i++) {
      const [x, y] = await Promise.all([a.next('tick'), b.next('tick')]); assert.deepEqual(x, y)
      tick = x
      if (x.inputs[helloB.id].special) break
    }
    assert.equal(tick.inputs[helloB.id].move.x, 1)
    assert.equal(tick.commands[0].id, helloB.id)
    const next = await a.next('tick'); assert.equal(next.tick, tick.tick + 1); assert.equal(next.inputs[helloB.id].special, false)
    b.ws.close(); assert.equal((await a.next('ended')).reason, 'disconnect'); assert.equal(app.rooms.size, 0)
  } finally { a.ws.terminate(); b.ws.terminate(); rejected.ws.terminate(); await app.close() }
})

test('limits rooms to four trainers and rejects unknown Pokémon', async () => {
  const app = createRoomServer(); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening')
  const url = `ws://127.0.0.1:${app.server.address().port}/rooms`, players = Array.from({ length: 5 }, () => client(url))
  try {
    await Promise.all(players.map((p) => p.next('hello')))
    players[0].send({ type: 'create', name: 'invalid', starter: '__proto__', mode: 'versus', version: 'test' })
    await players[0].next('error'); assert.equal(app.rooms.size, 0)
    players[0].send({ type: 'create', name: 'host', starter: 'charmander', mode: 'versus', version: 'test' })
    const { code } = await players[0].next('lobby')
    for (const p of players.slice(1, 4)) { p.send({ type: 'join', code, name: 'friend', starter: 'squirtle', version: 'test' }); await p.next('lobby') }
    players[4].send({ type: 'join', code, name: 'fifth', starter: 'squirtle', version: 'test' }); await players[4].next('error')
    assert.equal(app.rooms.get(code).players.length, 4)
  } finally { for (const p of players) p.ws.terminate(); await app.close() }
})

test('rejects unapproved WebSocket origins and exposes a health endpoint', async () => {
  const app = createRoomServer({ origins: ['https://game.example'] }); app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening')
  try {
    const port = app.server.address().port
    const health = await fetch(`http://127.0.0.1:${port}/health`); assert.deepEqual(await health.json(), { ok: true, rooms: 0 })
    const ws = new WebSocket(`ws://127.0.0.1:${port}/rooms`, { origin: 'https://other.example' })
    ws.on('error', () => {}); await new Promise((done) => ws.on('close', done)); assert.equal(app.rooms.size, 0)
  } finally { await app.close() }
})
