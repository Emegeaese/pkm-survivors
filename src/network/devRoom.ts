import type { RoomConnection } from './firebaseRooms'
import type { MatchMode, Trainer } from '../game/multiplayer'

/**
 * Dev builds only (`?devroom=coop|versus|duel`): an offline room with idle teammates that wander
 * (the first walks off, to test the off-screen markers), to look at the match HUD and layouts without accounts or a second player.
 */
export const createDevRoomConnection = (kind: string): RoomConnection => {
  const mode: MatchMode = kind === 'coop' ? 'coop' : 'versus'
  const bots: Trainer[] = [{ id: 'bot1', name: 'Misty', starter: 'squirtle', shiny: false }, { id: 'bot2', name: 'Brock', starter: 'bulbasaur', shiny: false }]
  const players: Trainer[] = [{ id: 'me', name: 'Ash', starter: 'charmander', shiny: false }, ...(kind === 'duel' ? bots.slice(0, 1) : bots)]
  let move = { x: 0, y: 0 }, special = false, tick = 0, timer: ReturnType<typeof setInterval> | null = null
  const commands: Array<{ id: string; kind: string; index?: number }> = []
  const conn: RoomConnection = {
    readyState: 1, onopen: null, onmessage: null, onerror: null, onclose: null,
    send: (data) => {
      const message = JSON.parse(data) as { type: string; move?: { x: number; y: number }; special?: boolean; kind?: string; index?: number }
      const deliver = (body: object) => conn.onmessage?.({ data: JSON.stringify(body) })
      if (message.type === 'create') {
        deliver({ type: 'hello', id: 'me' })
        deliver({ type: 'start', seed: 1234, mode, players })
        timer = setInterval(() => {
          tick++
          const t = tick / 30
          const inputs = { me: { move, special, mega: false, lunge: false }, bot1: { move: { x: 1, y: 0.2 }, special: false, mega: false, lunge: false }, bot2: { move: { x: Math.sin(t * 0.7), y: Math.cos(t * 0.7) }, special: false, mega: false, lunge: false } }
          special = false
          deliver({ type: 'tick', tick, inputs, commands: commands.splice(0).map((c) => ({ id: 'me', kind: c.kind, index: c.index })) })
        }, 1000 / 30)
      } else if (message.type === 'input' && message.move) { move = message.move; special = special || message.special === true }
      else if (message.type === 'command' && message.kind) commands.push({ id: 'me', kind: message.kind, index: message.index })
    },
    close: () => { if (timer) clearInterval(timer); timer = null },
  }
  setTimeout(() => conn.onopen?.(), 0)
  return conn
}
