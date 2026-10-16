import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { ref, set, get, remove, update } from 'firebase/database'

let env
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-pkm-survivors', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') }, database: { host: '127.0.0.1', port: 9000, rules: readFileSync('database.rules.json', 'utf8') } })
  await env.clearFirestore(); await env.clearDatabase()
})
after(async () => { await env?.cleanup() })
const db = (uid) => env.authenticatedContext(uid).firestore()
const roomDb = (uid) => env.authenticatedContext(uid).database()

test('private saves: owner, revisions, server timestamp and no public read', async () => {
  const owner = db('save-owner'), stranger = db('other')
  const save = { save: { wallet: 22 }, revision: 1, updatedAt: serverTimestamp() }
  await assertSucceeds(setDoc(doc(owner, 'pkmSaves/save-owner'), save))
  await assertSucceeds(getDoc(doc(owner, 'pkmSaves/save-owner')))
  await assertFails(getDoc(doc(stranger, 'pkmSaves/save-owner')))
  await assertFails(setDoc(doc(stranger, 'pkmSaves/save-owner'), { ...save, revision: 2 }))
  await assertFails(setDoc(doc(owner, 'pkmSaves/save-owner'), save))
  await assertSucceeds(setDoc(doc(owner, 'pkmSaves/save-owner'), { ...save, revision: 2 }))
})
test('unique handles and profile ownership', async () => {
  const owner = db('profile-owner'), other = db('profile-other'), batch = writeBatch(owner)
  batch.set(doc(owner, 'pkmHandles/ash'), { uid: 'profile-owner' })
  batch.set(doc(owner, 'pkmProfiles/profile-owner'), { uid: 'profile-owner', handle: 'ash', name: 'Ash', updatedAt: serverTimestamp() })
  await assertSucceeds(batch.commit())
  await assertFails(setDoc(doc(other, 'pkmHandles/ash'), { uid: 'profile-other' }))
  await assertFails(setDoc(doc(other, 'pkmProfiles/profile-owner'), { uid: 'profile-other', handle: 'ash', name: 'Fake', updatedAt: serverTimestamp() }))
})

const startRun = async (uid, id, mode = 'solo', challenge = null) => {
  const store = db(uid), team = mode === 'solo' ? [uid] : [uid, `${uid}-friend`]
  await setDoc(doc(store, 'pkmStarts', id), { id, uid, mode, team, names: team, teamSize: team.length, teamId: [...team].sort().join('_'), challenge, startedAt: serverTimestamp() })
  return { store, uid, id, team, mode }
}
const resultFor = (run, patch = {}) => ({ runId: run.id, uid: run.uid, name: 'Ash', handle: 'ash', team: run.team, names: run.team, starter: 'charmander', stage: 0, difficulty: 'normal', outcome: 'death', time: 2, level: 1, kills: 0, version: 'test', at: new Date().toISOString(), verified: false, score: 2, wins: 0, ...patch })
const submit = (run, board, row, result = resultFor(run)) => {
  const batch = writeBatch(run.store)
  batch.set(doc(run.store, 'pkmRuns', run.id), { ...result, mode: run.mode, startId: run.id, updatedAt: serverTimestamp() })
  batch.set(doc(run.store, 'pkmBoards', board, 'entries', row), result)
  return batch.commit()
}
test('solo scores require a valid start, elapsed clock and own row', async () => {
  const run = await startRun('solo-player', 'solo-start')
  await assertFails(submit(run, 'solo_normal_1_all_all', 'someone-else'))
  await assertFails(submit(run, 'coop_normal_2_all_all', run.uid))
  await assertFails(submit(run, 'solo_normal_1_all_all', run.uid, resultFor(run, { time: 3000, score: 3000 })))
  await assertFails(submit(run, 'solo_normal_1_all_all', run.uid, resultFor(run, { outcome: 'victory' })))
  await assertSucceeds(submit(run, 'solo_normal_1_all_all', run.uid))
  await assertFails(submit(run, 'solo_normal_1_all_all', run.uid))
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'pkmBoards/solo_normal_1_all_all/entries/solo-player')))
})
test('coop entries are tied to the team and versus allows early victory only once', async () => {
  const coop = await startRun('coop-player', 'coop-start', 'coop')
  await assertSucceeds(submit(coop, 'coop_normal_2_all_all', [...coop.team].sort().join('_')))
  const versus = await startRun('versus-player', 'versus-start', 'versus')
  await assertSucceeds(submit(versus, 'versus_normal_1_all_all', versus.uid, resultFor(versus, { outcome: 'victory', wins: 1, score: 1 })))
  await assertFails(submit(versus, 'versus_normal_1_all_all', versus.uid, resultFor(versus, { time: 3, outcome: 'victory', wins: 2, score: 2 })))
  await assertSucceeds(submit(versus, 'versus_normal_1_all_all', versus.uid, resultFor(versus, { time: 3, outcome: 'victory', wins: 1, score: 1 })))
})
test('daily challenge keeps the first finished run, including endless updates', async () => {
  const first = await startRun('daily-player', 'daily-first', 'solo', '2026-10-15')
  await assertSucceeds(submit(first, 'challenge_2026-10-15', first.uid))
  const second = await startRun(first.uid, 'daily-second', 'solo', '2026-10-15')
  await assertFails(submit(second, 'challenge_2026-10-15', second.uid, resultFor(second, { time: 5, score: 5 })))
  await assertSucceeds(submit(first, 'challenge_2026-10-15', first.uid, resultFor(first, { time: 3, score: 3 })))
})

test('rooms: four seats, private membership, host control and authenticated relay', async () => {
  const room = 'pkm2Rooms/ABCDEF', host = roomDb('host'), member = (uid, slot) => ({ id: uid, name: uid, starter: 'charmander', shiny: false, ready: false, slot })
  await assertFails(set(ref(env.unauthenticatedContext().database(), room), { host: 'host' }))
  await assertSucceeds(set(ref(host, room), { host: 'host', mode: 'coop', version: 'test', seed: 3, phase: 'lobby', createdAt: 1, seats: { 0: 'host' }, m: { host: member('host', 0) }, info: { phase: 'lobby', version: 'test' } }))
  const guest = roomDb('guest')
  await assertFails(get(ref(guest, room)))
  await assertSucceeds(get(ref(guest, `${room}/info`)))
  for (let slot = 1; slot <= 3; slot++) {
    const uid = slot === 1 ? 'guest' : `guest${slot}`, client = roomDb(uid)
    await assertSucceeds(set(ref(client, `${room}/seats/${slot}`), uid))
    await assertSucceeds(set(ref(client, `${room}/m/${uid}`), member(uid, slot)))
  }
  await assertFails(set(ref(roomDb('fifth'), `${room}/seats/4`), 'fifth'))
  await assertFails(set(ref(roomDb('fifth'), `${room}/m/fifth`), member('fifth', 1)))
  await assertSucceeds(get(ref(guest, room)))
  await assertFails(set(ref(guest, `${room}/host`), 'guest'))
  await assertFails(set(ref(guest, `${room}/m/host/ready`), true))
  await assertSucceeds(set(ref(guest, `${room}/m/guest/ready`), true))
  const message = 'pkm2Signals/ABCDEF/host/guest/msg'
  await assertSucceeds(set(ref(guest, message), JSON.stringify({ kind: 'data', value: {} })))
  await assertFails(set(ref(guest, 'pkm2Signals/ABCDEF/host/guest2/fake'), '{}'))
  await assertFails(get(ref(roomDb('outsider'), 'pkm2Signals/ABCDEF/host')))
  await assertSucceeds(get(ref(host, 'pkm2Signals/ABCDEF/host')))
  await assertSucceeds(remove(ref(host, message)))
  await assertSucceeds(update(ref(host, room), { phase: 'playing', 'info/phase': 'playing' }))
  await assertFails(set(ref(roomDb('late'), `${room}/seats/1`), 'late'))
  await assertSucceeds(update(ref(guest, room), { 'm/guest': null, 'seats/1': null }))
})
