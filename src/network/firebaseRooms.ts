import { firebaseServices } from '../firebase'
import { PLAYABLE } from '../data/hatchlings'
import { createRng } from '../engine/rng'
import type { Trainer, MatchMode } from '../game/multiplayer'
import type { StepInput } from '../game/game'
import type { Command } from '../game/multiplayer'
import type { Database, Unsubscribe } from 'firebase/database'

export type RoomConnection = { readyState: number; onopen: (() => void) | null; onmessage: ((event: { data: string }) => void) | null; onerror: ((code: string) => void) | null; onclose: (() => void) | null; send: (data: string) => void; close: () => void }
type Member = Trainer & { ready: boolean; slot: number }
type Room = { host: string; mode: MatchMode; seed: number; version: string; phase: 'lobby' | 'playing' | 'ended'; createdAt: number; m: Record<string, Member>; seats: Record<string, string>; roster?: Member[] }
type Peer = { pc: RTCPeerConnection | null; channel: RTCDataChannel | null; pending: RTCIceCandidateInit[]; queue: object[] }
type Message = Record<string, unknown>
const idle = (): StepInput => ({ move: { x: 0, y: 0 }, special: false, mega: false, lunge: false })
const isObject = (v: unknown): v is Message => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Firebase owns authentication, room membership, signaling and the fallback relay. */
export const createFirebaseRoomConnection = (): RoomConnection => {
  let database: Database, uid = '', code = '', slot = -1, isHost = false, room: Room | null = null, closed = false, started = false
  let timer: ReturnType<typeof setInterval> | null = null, flushTimer: ReturnType<typeof setInterval> | null = null
  let sdk: typeof import('firebase/database'), tick = 0, commands: Command[] = []
  const peers = new Map<string, Peer>(), off: Unsubscribe[] = [], inputs = new Map<string, StepInput>(), hashes = new Map<number, Map<string, number>>()
  const watchedSenders = new Set<string>(), received = new Set<string>(), pendingTicks = new Map<number, Message>(), inputSequence = new Map<string, number>()
  let nextTick = 1, messageSequence = 0
  const conn: RoomConnection = { readyState: 0, onopen: null, onmessage: null, onerror: null, onclose: null, send: (data) => {
    let message: unknown
    try { message = JSON.parse(data) } catch { return }
    if (isObject(message)) void handle(message).catch(error)
  }, close: () => { void close() } }
  const deliver = (data: object) => { if (!closed) conn.onmessage?.({ data: JSON.stringify(data) }) }
  const error = (e: unknown) => {
    const reason = isObject(e) && typeof e.code === 'string' ? e.code : e instanceof Error ? e.message : 'unavailable'
    if (!closed) conn.onerror?.(reason)
  }
  const path = (suffix = '') => sdk.ref(database, `pkm2Rooms/${code}${suffix}`)
  const close = async () => {
    if (closed) return
    closed = true; conn.readyState = 3
    if (timer) clearInterval(timer); if (flushTimer) clearInterval(flushTimer)
    for (const stop of off) stop()
    for (const peer of peers.values()) { peer.channel?.close(); peer.pc?.close() }
    peers.clear()
    if (code && sdk) {
      await sdk.onDisconnect(path()).cancel().catch(() => {})
      if (isHost) await sdk.remove(path()).catch(() => {})
      else if (slot >= 0) await sdk.update(path(), { [`m/${uid}`]: null, [`seats/${slot}`]: null }).catch(() => {})
    }
    conn.onclose?.()
  }
  const relay = async (to: string, kind: 'signal' | 'data', value: object) => {
    if (!closed && room?.m[to]) await sdk.push(sdk.ref(database, `pkm2Signals/${code}/${to}/${uid}`), JSON.stringify({ kind, value }))
  }
  const sendTo = (to: string, data: object) => {
    const peer = peers.get(to)
    if (!peer) return
    if (peer.channel?.readyState === 'open' && peer.channel.bufferedAmount < 1024 * 1024) peer.channel.send(JSON.stringify(data))
    else peer.queue.push(data)
  }
  const broadcast = (data: object) => { deliver(data); for (const id of Object.keys(room?.m ?? {})) if (id !== uid) sendTo(id, data) }
  const wireChannel = (id: string, peer: Peer, channel: RTCDataChannel) => {
    peer.channel = channel
    channel.onmessage = (event) => {
      if (typeof event.data !== 'string' || event.data.length > 200000) return
      try { const value: unknown = JSON.parse(event.data); if (isObject(value)) receive(id, value) } catch { /* Ignore malformed peer messages. */ }
    }
    channel.onopen = () => {
      for (const value of peer.queue.splice(0)) channel.send(JSON.stringify(value))
    }
  }
  const connectPeer = (id: string, offer: boolean) => {
    const existing = peers.get(id)
    if (existing) return existing
    const peer: Peer = { pc: null, channel: null, pending: [], queue: [] }; peers.set(id, peer)
    // Firebase relay remains usable when peer-to-peer traffic is blocked.
    if (import.meta.env.VITE_FIREBASE_FORCE_RELAY === 'true' || typeof RTCPeerConnection === 'undefined') return peer
    let pc: RTCPeerConnection
    try { pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] }) } catch { return peer }
    peer.pc = pc
    pc.onicecandidate = (event) => { if (event.candidate) void relay(id, 'signal', { candidate: event.candidate.toJSON() }).catch(error) }
    pc.ondatachannel = (event) => wireChannel(id, peer, event.channel)
    if (offer) {
      wireChannel(id, peer, pc.createDataChannel('pkm', { ordered: true }))
      void pc.createOffer().then(async (description) => { await pc.setLocalDescription(description); await relay(id, 'signal', { description }) }).catch(error)
    }
    return peer
  }
  const signal = async (from: string, data: Message) => {
    if (!room?.m[from]) return
    const peer = connectPeer(from, false)
    if (!peer.pc) return
    if (isObject(data.description)) {
      const description = data.description as unknown as RTCSessionDescriptionInit
      await peer.pc.setRemoteDescription(description)
      for (const candidate of peer.pending.splice(0)) await peer.pc.addIceCandidate(candidate)
      if (description.type === 'offer') { const answer = await peer.pc.createAnswer(); await peer.pc.setLocalDescription(answer); await relay(from, 'signal', { description: answer }) }
    } else if (isObject(data.candidate)) {
      const candidate = data.candidate as RTCIceCandidateInit
      if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(candidate); else peer.pending.push(candidate)
    }
  }
  const normalize = (message: Message): StepInput | null => {
    if (!isObject(message.move)) return null
    const { x, y } = message.move
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null
    const length = Math.max(1, Math.hypot(x, y))
    return { move: { x: x / length, y: y / length }, special: message.special === true, mega: message.mega === true, lunge: message.lunge === true }
  }
  const receive = (from: string, message: Message) => {
    if (closed || !room?.m[from]) return
    if (from === room.host && room.host !== uid) {
      if (message.type === 'tick' && typeof message.tick === 'number' && message.tick >= nextTick) {
        pendingTicks.set(message.tick, message)
        if (started) while (pendingTicks.has(nextTick)) { const tick = pendingTicks.get(nextTick)!; pendingTicks.delete(nextTick++); deliver(tick) }
        if (pendingTicks.size > 180) { deliver({ type: 'ended', reason: 'slow' }); void close() }
      } else if (message.type === 'ended') deliver(message)
      return
    }
    if (room.host !== uid) return
    if (typeof message.seq === 'number') {
      const key = `${from}:${message.seq}`
      if (received.has(key)) return
      received.add(key); if (received.size > 4096) received.delete(received.values().next().value!)
    }
    if (message.type === 'input') {
      const input = normalize(message), previous = inputs.get(from) ?? idle()
      if (input) {
        const fresh = Number(message.seq ?? 0) >= (inputSequence.get(from) ?? 0)
        inputs.set(from, { ...(fresh ? input : previous), special: previous.special || input.special, mega: previous.mega || input.mega, lunge: previous.lunge || input.lunge })
        if (fresh) inputSequence.set(from, Number(message.seq ?? 0))
      }
    }
    if (message.type === 'command' && commands.length < 32 && !commands.some((c) => c.id === from)) {
      if (message.kind === 'pick' && Number.isInteger(message.index) && Number(message.index) >= 0 && Number(message.index) < 8) commands.push({ id: from, kind: 'pick', index: Number(message.index) })
      else if ((message.kind === 'pause' || message.kind === 'endless') && room.mode === 'coop' && (message.kind !== 'endless' || from === uid)) commands.push({ id: from, kind: message.kind })
    }
    if (message.type === 'ack' && typeof message.tick === 'number' && typeof message.hash === 'number') {
      const checks = hashes.get(message.tick) ?? new Map<string, number>()
      checks.set(from, message.hash); hashes.set(message.tick, checks)
      if (new Set(checks.values()).size > 1) { broadcast({ type: 'ended', reason: 'desync' }); void close() }
      for (const at of hashes.keys()) if (at < tick - 180) hashes.delete(at)
    }
  }
  const flushRelay = () => {
    for (const [id, peer] of peers) if (peer.queue.length) {
      let queue = peer.queue.splice(0)
      // Preserve every ordered simulation tick; only coalesce held inputs and acknowledgements.
      const input = queue.filter((p) => isObject(p) && p.type === 'input') as Message[]
      if (input.length) {
        const last = input.at(-1)!
        queue = queue.filter((p) => !isObject(p) || p.type !== 'input')
        queue.push({ ...last, special: input.some((p) => p.special), mega: input.some((p) => p.mega), lunge: input.some((p) => p.lunge) })
      }
      queue = queue.filter((p) => !isObject(p) || p.type !== 'ack' || typeof p.hash === 'number')
      if (!queue.length) continue
      const batches: object[][] = []; let batch: object[] = []
      for (const packet of queue) {
        if (JSON.stringify(batch).length + JSON.stringify(packet).length > 90000) { batches.push(batch); batch = [] }
        batch.push(packet)
      }
      if (batch.length) batches.push(batch)
      for (const messages of batches) void relay(id, 'data', { messages }).catch(error)
    }
  }
  const watchRoom = () => {
    off.push(sdk.onValue(path(), (snapshot) => {
      const next = snapshot.val() as Room | null
      if (!next || next.phase === 'ended' || !next.m?.[next.host]) { deliver({ type: 'ended', reason: 'disconnect' }); void close(); return }
      const previous = room
      room = next
      const players = Object.values(room.m ?? {}).sort((a, b) => a.id === room!.host ? -1 : b.id === room!.host ? 1 : a.id.localeCompare(b.id))
      if (room.host === uid) {
        if (previous?.phase === 'lobby' && room.phase === 'lobby' && Object.keys(previous.m).sort().join() !== Object.keys(room.m).sort().join()) {
          const reset = Object.fromEntries(players.filter((p) => p.ready).map((p) => [`m/${p.id}/ready`, false]))
          if (Object.keys(reset).length) void sdk.update(path(), reset).catch(error)
        }
        for (const [id, peer] of peers) if (!room.m[id]) { peer.channel?.close(); peer.pc?.close(); peers.delete(id); inputs.delete(id) }
        for (const p of players) if (p.id !== uid) connectPeer(p.id, true)
        if (started && (room.roster ?? []).some((p) => !room!.m[p.id])) { broadcast({ type: 'ended', reason: 'disconnect' }); void close(); return }
      } else connectPeer(room.host, false)
      if (room.phase === 'lobby') deliver({ type: 'lobby', code, host: room.host, seed: room.seed, mode: room.mode, players })
      else if (!started && room.roster) begin()
    }, error))
    off.push(sdk.onChildAdded(sdk.ref(database, `pkm2Signals/${code}/${uid}`), (sender) => {
      if (watchedSenders.has(sender.key!)) return
      watchedSenders.add(sender.key!)
      off.push(sdk.onChildAdded(sender.ref, (snapshot) => {
        const raw = snapshot.val()
        void sdk.remove(snapshot.ref).catch(() => {})
        if (typeof raw !== 'string' || raw.length > 200000) return
        try {
          const message: unknown = JSON.parse(raw), from = sender.key!
          if (!isObject(message) || !isObject(message.value)) return
          if (message.kind === 'signal') void signal(from, message.value).catch(error)
          else if (message.kind === 'data' && Array.isArray(message.value.messages)) for (const item of message.value.messages) if (isObject(item)) receive(from, item)
        } catch { /* Ignore malformed relay messages. */ }
      }, error))
    }, error))
    flushTimer = setInterval(flushRelay, 200)
  }
  const begin = () => {
    if (started || !room?.roster) return
    started = true
    deliver({ type: 'start', seed: room.seed, mode: room.mode, players: room.roster })
    while (pendingTicks.has(nextTick)) { const packet = pendingTicks.get(nextTick)!; pendingTicks.delete(nextTick++); deliver(packet) }
    if (room.host !== uid) return
    timer = setInterval(() => {
      if (closed || !room?.roster) return
      tick++
      const frameInputs = Object.fromEntries(room.roster.map((p) => [p.id, inputs.get(p.id) ?? idle()]))
      broadcast({ type: 'tick', tick, inputs: frameInputs, commands: commands.splice(0) })
      for (const [id, input] of inputs) inputs.set(id, { ...input, special: false, mega: false, lunge: false })
    }, 1000 / 30)
  }
  const handle = async (message: Message) => {
    if (closed) return
    if (message.type === 'create' || message.type === 'join') {
      if (code || typeof message.starter !== 'string' || !Object.hasOwn(PLAYABLE, message.starter) || typeof message.version !== 'string') return
      const member: Member = { id: uid, name: String(message.name ?? 'Trainer').slice(0, 24), starter: message.starter as Trainer['starter'], shiny: message.shiny === true, ready: false, slot: 0 }
      if (message.type === 'create') {
        if (message.mode !== 'coop' && message.mode !== 'versus') return
        const random = new Uint32Array(1); crypto.getRandomValues(random)
        const rng = createRng(random[0]!)
        for (let i = 0; i < 5; i++) {
          code = Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0').toUpperCase()
          const created = await sdk.runTransaction(path(), (current: Room | null) => current ? undefined : { host: uid, version: message.version, mode: message.mode, seed: random[0], phase: 'lobby', createdAt: sdk.serverTimestamp(), m: { [uid]: member }, seats: { 0: uid } })
          if (created.committed) break
          code = ''
        }
        if (!code) throw new Error('unavailable')
        slot = 0; isHost = true
      } else {
        code = String(message.code).toUpperCase()
        if (!/^[A-F0-9]{6}$/.test(code)) { code = ''; throw new Error('unavailable') }
        const info = (await sdk.get(path('/info'))).val() as { phase?: string; version?: string } | null
        if (!info || info.phase !== 'lobby' || info.version !== message.version) { code = ''; throw new Error('unavailable') }
        for (let i = 1; i <= 3; i++) {
          const seat = await sdk.runTransaction(path(`/seats/${i}`), (value: string | null) => value ? undefined : uid)
          if (seat.committed) { slot = i; break }
        }
        if (slot < 0) { code = ''; throw new Error('room-full') }
        member.slot = slot
        try { await sdk.set(path(`/m/${uid}`), member) } catch (e) { await sdk.remove(path(`/seats/${slot}`)).catch(() => {}); throw e }
      }
      if (message.type === 'create') await sdk.set(path('/info'), { phase: 'lobby', version: message.version })
      if (isHost) await sdk.onDisconnect(path()).remove()
      else await sdk.onDisconnect(path()).update({ [`m/${uid}`]: null, [`seats/${slot}`]: null })
      watchRoom(); return
    }
    if (!room) return
    if (message.type === 'ready' && room.phase === 'lobby') await sdk.update(path(`/m/${uid}`), { ready: message.ready === true })
    else if (message.type === 'start' && room.phase === 'lobby' && room.host === uid) {
      const members = Object.values(room.m)
      if (members.length < 2 || members.length > 4 || !members.every((p) => p.ready)) return
      const roster = members.sort((a, b) => a.id === uid ? -1 : b.id === uid ? 1 : a.id.localeCompare(b.id))
      await sdk.update(path(), { roster, phase: 'playing', 'info/phase': 'playing' })
    } else if (room.host === uid) receive(uid, { ...message, seq: ++messageSequence })
    else sendTo(room.host, { ...message, seq: ++messageSequence })
  }
  void firebaseServices().then(async (services) => {
    database = services.database; sdk = await import('firebase/database')
    await services.auth.authStateReady()
    uid = services.auth.currentUser?.uid ?? ''
    if (!uid) throw new Error('auth-required')
    if (!closed) { conn.readyState = 1; conn.onopen?.(); deliver({ type: 'hello', id: uid }) }
  }).catch(error)
  return conn
}
