import type { Input } from '../engine/input'
import { accountUserId } from '../account'
import { PLAYABLE, PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { gachaCopies } from '../game/gacha'
import { cancelTrade, confirmTrade, finalizeTrade, offerTrade, watchTrades, type Trade, type TradeOffer } from '../firebaseTrading'
import { socialText } from '../i18n/social'
import { featureText } from '../i18n/features'
import { portraitUrl } from '../render/sprites'
import { h, later } from './dom'
import { loadSave, onSaveChange } from './save'
import type { Screen } from './screens'

export const tradingScreen = (root: HTMLElement, input: Input, other: { uid: string; name: string }, back: () => void): Screen => {
  const m = socialText(), f = featureText(), uid = accountUserId()!
  let disposed = false, busy = false, trades: Trade[] = [], selected: string | null = null, stop = () => {}
  let lastAnimation: string | null = null
  const select = h('select', { 'aria-label': m.choose }), status = h('p', { role: 'status', 'aria-live': 'polite' })
  const offers = h('div', { class: 'trade-offers' }), actions = h('div', { class: 'buttons' }), history = h('div', { class: 'trade-history' })
  const animation = h('div', { class: 'trade-animation hidden', 'aria-live': 'polite' })
  const el = h('div', { class: 'screen feature-screen trade-screen' }, h('div', { class: 'feature-panel box' }, h('h1', {}, `${m.trade} · ${other.name}`), h('p', {}, m.tradeInfo),
    h('label', {}, m.inventory, select), offers, status, actions, animation, h('h2', {}, m.history), history, h('button', { class: 'btn', onclick: () => later(close) }, m.back)))
  const run = async (action: () => Promise<unknown>) => {
    if (busy || disposed) return
    busy = true; actions.querySelectorAll('button').forEach((b) => { b.disabled = true }); status.textContent = m.loading
    try { await action(); if (!disposed) status.textContent = '' } catch { if (!disposed) status.textContent = m.error }
    finally { busy = false; if (!disposed) render() }
  }
  const inventory = () => {
    const previous = select.value, save = loadSave()
    const options = PLAYABLE_IDS.flatMap((id) => [false, true].flatMap((shiny) => {
      const count = gachaCopies(save.gacha, id, shiny)
      return count > 0 ? [h('option', { value: `${id}:${shiny ? 's' : 'n'}` }, `${PLAYABLE[id].name}${shiny ? ' ✨' : ''} ×${count}`)] : []
    }))
    select.replaceChildren(h('option', { value: '' }, m.choose), ...options)
    if ([...select.options].some((o) => o.value === previous)) select.value = previous
  }
  const offerCard = (label: string, offer: TradeOffer | null) => h('div', { class: 'box trade-pokemon' }, h('b', {}, label),
    ...(offer ? [h('img', { src: portraitUrl(PLAYABLE[offer.id].line[0].dex, offer.shiny), alt: PLAYABLE[offer.id].name }), h('span', {}, `${PLAYABLE[offer.id].name}${offer.shiny ? ' ✨' : ''}`)] : [h('span', {}, m.noOffer)]))
  const render = () => {
    if (disposed) return
    inventory()
    const relevant = trades.filter((t) => t.users.includes(other.uid))
    const trade = relevant.find((t) => t.id === selected) ?? relevant.find((t) => t.status === 'open')
    if (trade) selected = trade.id
    const left = trade?.users[0] === uid, mine = trade ? left ? trade.left : trade.right : null, theirs = trade ? left ? trade.right : trade.left : null
    offers.replaceChildren(offerCard(m.myOffer, mine), h('span', { class: 'trade-arrow' }, '⇄'), offerCard(m.theirOffer, theirs))
    const offer = h('button', { class: 'btn', disabled: busy || !select.value, onclick: () => {
      const [id, variant] = select.value.split(':')
      if (trade?.status !== 'open') selected = null
      if (id) void run(() => offerTrade(other.uid, { id: id as PlayableId, shiny: variant === 's' }, trade?.status === 'open' ? trade : undefined))
    } }, m.send)
    actions.replaceChildren(offer)
    if (trade?.status === 'open') {
      const accepted = left ? trade.leftAccepted : trade.rightAccepted
      actions.append(h('button', { class: 'btn', disabled: busy || !mine || !theirs || accepted, onclick: () => { void run(() => confirmTrade(trade)) } }, accepted ? m.waiting : m.confirm),
        h('button', { class: 'btn', disabled: busy, onclick: () => { void run(() => cancelTrade(trade.id)) } }, m.cancel))
    }
    if (trade?.status === 'done' && mine && theirs) {
      status.textContent = m.done
      if (lastAnimation !== trade.id) {
        lastAnimation = trade.id
        animation.classList.remove('hidden')
        animation.replaceChildren(offerCard(m.myOffer, mine), offerCard(m.theirOffer, theirs), h('b', {}, m.done),
          h('button', { class: 'btn', onclick: () => animation.classList.add('hidden') }, f.skipAnimation))
      }
    } else animation.classList.add('hidden')
    history.replaceChildren(...relevant.slice(0, 20).map((t) => h('button', { class: 'btn', onclick: () => { selected = t.id; render() } },
      `${t.status === 'done' ? '✓' : t.status === 'cancelled' ? '✕' : '…'} ${t.left ? PLAYABLE[t.left.id].name : m.noOffer} ⇄ ${t.right ? PLAYABLE[t.right.id].name : m.noOffer}`)))
  }
  select.onchange = () => render()
  const offSave = onSaveChange(() => render())
  const offKey = input.onKey((key) => { if (key === 'Escape') later(close) })
  const dispose = () => { if (disposed) return; disposed = true; stop(); offSave(); offKey(); el.remove() }
  const close = () => { dispose(); back() }
  root.append(el); render()
  void watchTrades((next) => {
    trades = next; render()
    for (const trade of next) if (trade.status === 'open' && trade.leftAccepted && trade.rightAccepted) void finalizeTrade(trade.id).catch(() => { if (!disposed) status.textContent = m.error })
  }, () => { if (!disposed) status.textContent = m.error }).then((off) => { if (disposed) off(); else stop = off }).catch(() => { if (!disposed) status.textContent = m.error })
  return { el, dispose }
}
