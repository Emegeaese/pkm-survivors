import type { Input } from '../engine/input'
import { createRng } from '../engine/rng'
import { PLAYABLE, PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import { generationOf } from '../data/catalogue'
import { BANNERS, bannerPool, bannerRarity, bundleTickets, ownsPokemon, ownsShiny, PITY, pullGacha, tickets } from '../game/gacha'
import { DIFFICULTY_IDS } from '../game/difficulty'
import { MOVES } from '../game/moves'
import { resolveSpecial } from '../game/special'
import { t } from '../i18n'
import { featureText } from '../i18n/features'
import { portraitUrl } from '../render/sprites'
import { h, later } from './dom'
import { loadSave, updateSave, writeSave } from './save'
import type { Screen } from './screens'

export const catalogueSelect = (root: HTMLElement, input: Input, actions: { pick: (id: PlayableId) => void; incubator: () => void; gacha: () => void }, initial: PlayableId = 'charmander'): Screen & { selected: () => PlayableId } => {
  const m = featureText()
  let selected = initial, page = 0
  let picking = false
  const save = loadSave()
  const confirm = () => { if (!picking && ownsPokemon(save, selected)) { picking = true; later(() => actions.pick(selected)) } }
  const query = h('input', { type: 'search', placeholder: m.search, 'aria-label': m.search })
  const region = h('select', { 'aria-label': m.all }, h('option', { value: '0' }, m.all), ...BANNERS.map((b, i) => h('option', { value: i + 1 }, b)))
  const owned = h('input', { type: 'checkbox' })
  const grid = h('div', { class: 'collection-grid' })
  const detail = h('div', { class: 'collection-detail box' })
  const count = h('span')
  const showDetail = () => {
    const p = PLAYABLE[selected], dex = p.line[0].dex
    const canPlay = ownsPokemon(save, selected)
    const toggle = ownsShiny(save, selected) ? h('button', { class: 'btn', onclick: () => {
      const current = loadSave().shinyStarters[selected] === true
      updateSave((s) => ({ ...s, shinyStarters: { ...s.shinyStarters, [selected]: !current } }))
      showDetail()
    } }, loadSave().shinyStarters[selected] ? m.shiny : m.normal) : null
    detail.replaceChildren(h('img', { class: 'collection-portrait', src: portraitUrl(dex, loadSave().shinyStarters[selected] === true), alt: p.name }), h('h2', {}, `#${dex} ${p.name}`),
      h('p', {}, p.line.map((s) => s.name).join(' → ')), h('p', {}, p.line[0].types.join(' / ')),
      h('p', {}, p.learnset.map((id) => MOVES[id].name).join(' · ')), h('p', {}, resolveSpecial(selected, 0).tier.name), ...(toggle ? [toggle] : []),
      h('button', { class: 'btn', onclick: () => canPlay ? confirm() : later(actions.gacha) }, canPlay ? m.play : m.locked))
  }
  const redraw = () => {
    const q = query.value.trim().toLowerCase()
    const ids = PLAYABLE_IDS.filter((id) => {
      const p = PLAYABLE[id]
      return (!owned.checked || ownsPokemon(save, id)) && (!Number(region.value) || generationOf(p.line[0].dex) === Number(region.value)) && (!q || p.name.toLowerCase().includes(q) || String(p.line[0].dex) === q)
    }).sort((a, b) => PLAYABLE[a].line[0].dex - PLAYABLE[b].line[0].dex)
    const pages = Math.max(1, Math.ceil(ids.length / 60))
    page = Math.min(page, pages - 1)
    count.textContent = `${page + 1}/${pages} · ${ids.length}`
    grid.replaceChildren(...ids.slice(page * 60, page * 60 + 60).map((id) => h('button', {
      class: `collection-cell ${ownsPokemon(save, id) ? '' : 'locked'} ${selected === id ? 'selected' : ''}`,
      title: PLAYABLE[id].name, onclick: () => { selected = id; redraw(); showDetail() },
    }, h('img', { src: portraitUrl(PLAYABLE[id].line[0].dex), alt: '', loading: 'lazy' }), h('span', {}, PLAYABLE[id].name), !ownsPokemon(save, id) && '🔒')))
  }
  query.oninput = region.onchange = owned.onchange = () => { page = 0; redraw() }
  const difficulty = h('select', { 'aria-label': t().difficulty.names[save.difficulty] }, ...DIFFICULTY_IDS.map((id) => h('option', { value: id, selected: id === save.difficulty }, t().difficulty.names[id])))
  difficulty.onchange = () => updateSave((s) => ({ ...s, difficulty: DIFFICULTY_IDS.find((id) => id === difficulty.value) ?? s.difficulty }))
  const el = h('div', { class: 'screen feature-screen' }, h('div', { class: 'feature-panel box' }, h('h1', {}, m.collection),
    h('div', { class: 'feature-tools' }, query, region, h('label', {}, owned, m.owned), difficulty, h('button', { class: 'btn', onclick: actions.gacha }, m.gacha), h('button', { class: 'btn', onclick: actions.incubator }, t().eggs.tab)),
    h('div', { class: 'collection-layout' }, grid, detail), h('div', { class: 'buttons' }, h('button', { class: 'btn', onclick: () => { page = Math.max(0, page - 1); redraw() } }, '◀'), count, h('button', { class: 'btn', onclick: () => { page++; redraw() } }, '▶'))))
  const off = input.onKey((key) => { if ((key === 'Enter' || key === 'Space') && document.activeElement?.tagName !== 'INPUT') confirm() })
  root.append(el); redraw(); showDetail(); query.focus()
  return { el, selected: () => selected, dispose: () => { off(); el.remove() } }
}

export const gachaScreen = (root: HTMLElement, input: Input, back: () => void): Screen => {
  const m = featureText()
  const region = h('select', { 'aria-label': m.gacha }, ...BANNERS.map((b, i) => h('option', { value: i + 1 }, b)))
  const balance = h('p'), pity = h('p'), prizes = h('div', { class: 'gacha-prizes' }), results = h('div', { class: 'gacha-results', 'aria-live': 'polite' })
  const one = h('button', { class: 'btn', onclick: () => draw(1) }, m.pull)
  const ten = h('button', { class: 'btn', onclick: () => draw(10) }, m.ten)
  const bundle = h('button', { class: 'btn', onclick: () => draw(10, true) }, m.bundle)
  const refresh = () => {
    const s = loadSave(), gen = Number(region.value)
    balance.textContent = `${m.tickets}: ${tickets(s.gacha)} · ${m.bundles}: ${bundleTickets(s.gacha)}`
    pity.textContent = `${m.pity}: ${s.gacha.banners[gen]?.pity ?? 0}/${PITY}`
    one.disabled = tickets(s.gacha) < 1; ten.disabled = tickets(s.gacha) < 10; bundle.disabled = bundleTickets(s.gacha) < 1
    prizes.replaceChildren(...bannerPool(gen).filter((id) => bannerRarity(id, gen) === 5).slice(0, 5).map((id) => h('div', {}, h('img', { src: portraitUrl(PLAYABLE[id].line[0].dex), alt: PLAYABLE[id].name }), h('span', {}, PLAYABLE[id].name))))
  }
  const draw = (count: 1 | 10, useBundle = false) => {
    const entropy = new Uint32Array(1); crypto.getRandomValues(entropy)
    const out = pullGacha(loadSave(), count, Number(region.value), createRng(entropy[0]!), useBundle)
    if (!out) return
    writeSave(out.save)
    results.replaceChildren(...out.pulls.map((p, i) => h('div', { class: `gacha-card box rarity-${p.rarity}`, style: `animation-delay:${i * 70}ms` },
      h('img', { src: portraitUrl(PLAYABLE[p.id].line[0].dex, p.shiny), alt: PLAYABLE[p.id].name }), h('b', {}, PLAYABLE[p.id].name), h('span', {}, '★'.repeat(p.rarity)),
      h('span', {}, p.shiny ? `✨ ${m.shiny}` : m.normal), h('small', {}, p.fresh ? m.new : `+₽${p.refund}`))))
    refresh()
  }
  region.onchange = refresh
  const el = h('div', { class: 'screen feature-screen' }, h('div', { class: 'feature-panel box' }, h('h1', {}, m.gacha), balance, region, prizes,
    h('p', {}, m.gachaInfo), h('p', {}, m.guarantee), h('small', {}, m.odds), pity, h('div', { class: 'buttons' }, one, ten, bundle), results, h('button', { class: 'btn', onclick: back }, m.back)))
  const off = input.onKey((k) => { if (k === 'Escape') later(back) })
  root.append(el); refresh()
  return { el, dispose: () => { off(); el.remove() } }
}
