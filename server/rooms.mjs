import { createServer } from 'node:http'
import { randomBytes, randomInt } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import catalogue from './room-catalogue.json' with { type: 'json' }

const allowed = new Set(catalogue)
const emptyInput = () => ({ move: { x: 0, y: 0 }, special: false, mega: false, lunge: false })
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }

/** Ordered input relay for private, unranked friend matches. No account credentials are required. */
export const createRoomServer = ({ origins = [], maxRooms = 200, maxConnections = 1000, staticRoot = resolve('dist') } = {}) => {
  const rooms = new Map(), clients = new Set()
  const server = createServer(async (req, res) => {
    if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true, rooms: rooms.size })); return }
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      const file = resolve(staticRoot, '.' + (path.endsWith('/') ? path + 'index.html' : path))
      if (!file.startsWith(staticRoot + sep)) throw new Error('path')
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); res.end(body)
    } catch { res.writeHead(404); res.end('Not found') }
  })
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false })
  const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)) }
  const broadcast = (room, data) => { for (const p of room.players) send(p.ws, data) }
  const trainer = (p) => ({ id: p.id, name: p.name, starter: p.starter, shiny: p.shiny, ready: p.ready })
  const lobby = (room) => broadcast(room, { type: 'lobby', code: room.code, mode: room.mode, seed: room.seed, host: room.players[0]?.id, players: room.players.map(trainer) })
  const endRoom = (room, reason) => {
    if (!rooms.has(room.code)) return
    clearInterval(room.timer); rooms.delete(room.code)
    for (const p of room.players) { p.room = null; send(p.ws, { type: 'ended', reason }) }
  }
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://localhost').pathname !== '/rooms' || (origins.length && !origins.includes(req.headers.origin)) || clients.size >= maxConnections) { socket.destroy(); return }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws))
  })
  wss.on('connection', (ws) => {
    const p = { ws, id: randomBytes(8).toString('hex'), room: null, ready: false, input: emptyInput(), alive: true, count: 0, period: Date.now(), ack: 0 }
    clients.add(p)
    send(ws, { type: 'hello', id: p.id })
    ws.on('pong', () => { p.alive = true })
    ws.on('error', () => {})
    ws.on('message', (raw) => {
      if (Date.now() - p.period > 1000) { p.period = Date.now(); p.count = 0 }
      if (++p.count > 120) { ws.close(1008, 'Rate limit'); return }
      let msg
      try { msg = JSON.parse(raw.toString()) } catch { send(ws, { type: 'error' }); return }
      if (!msg || typeof msg !== 'object') return
      if ((msg.type === 'create' || msg.type === 'join') && !p.room) {
        if (typeof msg.name !== 'string' || !allowed.has(msg.starter) || typeof msg.version !== 'string' || msg.version.length > 60) { send(ws, { type: 'error' }); return }
        p.name = msg.name.trim().slice(0, 24) || 'Trainer'; p.starter = msg.starter; p.shiny = msg.shiny === true
        let room
        if (msg.type === 'create') {
          if (rooms.size >= maxRooms || !['coop', 'versus'].includes(msg.mode)) { send(ws, { type: 'error' }); return }
          let code
          do { code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase() } while (rooms.has(code))
          room = { code, seed: randomInt(1, 0x7fffffff), mode: msg.mode, version: msg.version, players: [], phase: 'lobby', tick: 0, commands: [], created: Date.now(), checks: new Map() }
          rooms.set(code, room)
        } else room = typeof msg.code === 'string' ? rooms.get(msg.code.toUpperCase()) : null
        if (!room || room.phase !== 'lobby' || room.players.length >= 4 || room.version !== msg.version) { send(ws, { type: 'error' }); return }
        p.room = room; room.players.push(p)
        for (const player of room.players) player.ready = false
        lobby(room); return
      }
      const room = p.room
      if (!room) return
      if (msg.type === 'ready' && room.phase === 'lobby') { p.ready = msg.ready === true; lobby(room) }
      if (msg.type === 'start' && room.phase === 'lobby' && room.players[0] === p && room.players.length >= 2 && room.players.every((p) => p.ready)) {
        room.phase = 'playing'; room.started = Date.now()
        broadcast(room, { type: 'start', seed: room.seed, mode: room.mode, players: room.players.map(trainer) })
        room.timer = setInterval(() => {
          if (room.tick > 0 && room.players.some((p) => p.ws.readyState === WebSocket.OPEN && (p.ws.bufferedAmount > 1024 * 1024 || room.tick - p.ack > 180))) { endRoom(room, 'slow'); return }
          if (Date.now() - room.started > 90 * 60 * 1000) { endRoom(room, 'timeout'); return }
          room.tick++
          const inputs = Object.fromEntries(room.players.map((p) => [p.id, p.input]))
          broadcast(room, { type: 'tick', tick: room.tick, inputs, commands: room.commands.splice(0) })
          for (const p of room.players) { p.input = { ...p.input, special: false, mega: false, lunge: false } }
        }, 1000 / 30)
      }
      if (msg.type === 'input' && room.phase === 'playing') {
        const x = msg.move?.x, y = msg.move?.y
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return
        const length = Math.max(1, Math.hypot(x, y))
        p.input = { move: { x: x / length, y: y / length }, special: p.input.special || msg.special === true, mega: p.input.mega || msg.mega === true, lunge: p.input.lunge || msg.lunge === true }
      }
      if (msg.type === 'command' && room.phase === 'playing') {
        if (room.commands.length >= 32 || room.commands.some((c) => c.id === p.id)) return
        if (msg.kind === 'pick' && Number.isInteger(msg.index) && msg.index >= 0 && msg.index < 8) room.commands.push({ id: p.id, kind: 'pick', index: msg.index })
        if (msg.kind === 'pause' && room.mode === 'coop') room.commands.push({ id: p.id, kind: 'pause' })
        if (msg.kind === 'endless' && room.mode === 'coop' && room.players[0] === p) room.commands.push({ id: p.id, kind: 'endless' })
      }
      if (msg.type === 'ack' && Number.isInteger(msg.tick) && msg.tick <= room.tick && msg.tick >= p.ack) {
        p.ack = msg.tick
        if (Number.isInteger(msg.hash) && msg.tick % 90 === 0) {
          const checks = room.checks.get(msg.tick) ?? new Map()
          checks.set(p.id, msg.hash); room.checks.set(msg.tick, checks)
          if (new Set(checks.values()).size > 1) { endRoom(room, 'desync'); return }
          for (const tick of room.checks.keys()) if (tick < room.tick - 180) room.checks.delete(tick)
        }
      }
      if (msg.type === 'finish' && room.phase === 'playing') {
        p.finished = true
        if (room.players.every((p) => p.finished || p.ws.readyState !== WebSocket.OPEN)) endRoom(room, 'finished')
      }
    })
    ws.on('close', () => {
      clients.delete(p)
      const room = p.room
      if (!room || !rooms.has(room.code)) return
      if (room.phase === 'playing') { endRoom(room, 'disconnect'); return }
      room.players = room.players.filter((x) => x !== p)
      for (const x of room.players) x.ready = false
      if (!room.players.length) rooms.delete(room.code); else lobby(room)
    })
  })
  const heartbeat = setInterval(() => {
    for (const p of clients) { if (!p.alive) p.ws.terminate(); else { p.alive = false; p.ws.ping() } }
    for (const room of rooms.values()) if (room.phase === 'lobby' && Date.now() - room.created > 30 * 60 * 1000) endRoom(room, 'timeout')
  }, 15000)
  const close = () => {
    clearInterval(heartbeat)
    for (const room of rooms.values()) endRoom(room, 'shutdown')
    for (const p of clients) p.ws.terminate()
    wss.close(); return new Promise((done) => server.close(done))
  }
  return { server, rooms, close }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createRoomServer({ origins: (process.env.ROOM_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean) })
  const port = Number(process.env.PORT ?? 8787)
  app.server.listen(port, '0.0.0.0', () => console.log(`PKM rooms and game: http://localhost:${port} (WebSocket /rooms)`))
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { void app.close().then(() => process.exit(0)) })
}
