import type { Input } from '../engine/input'
import { createRng } from '../engine/rng'
import { PLAYABLE } from '../data/hatchlings'
import { BANNERS, bannerPool, bannerRarity, bundleTickets, PITY, pullGacha, tickets } from '../game/gacha'
import { featureText } from '../i18n/features'
import { portraitUrl } from '../render/sprites'
import { h, later } from './dom'
import { loadSave, writeSave } from './save'
import type { Screen } from './screens'

export const gachaScreen = (root: HTMLElement, input: Input, back: () => void): Screen => {
  const m = featureText()
  let spinning = false, disposed = false, timer: ReturnType<typeof setTimeout> | undefined
  let reveal: (() => void) | null = null
  const wheel = h('div', { class: 'gacha-wheel hidden', 'aria-label': m.gacha })
  const skip = h('button', { class: 'btn hidden', onclick: () => reveal?.() }, m.skipAnimation)
  const region = h('select', { 'aria-label': m.gacha }, ...BANNERS.map((b, i) => h('option', { value: i + 1 }, b)))
  const balance = h('p'), pity = h('p'), prizes = h('div', { class: 'gacha-prizes' }), results = h('div', { class: 'gacha-results', 'aria-live': 'polite' })
  const one = h('button', { class: 'btn', onclick: () => draw(1) }, m.pull)
  const ten = h('button', { class: 'btn', onclick: () => draw(10) }, m.ten)
  const bundle = h('button', { class: 'btn', onclick: () => draw(10, true) }, m.bundle)
  const refresh = () => {
    const s = loadSave(), gen = Number(region.value)
    balance.textContent = `${m.tickets}: ${tickets(s.gacha)} · ${m.bundles}: ${bundleTickets(s.gacha)}`
    pity.textContent = `${m.pity}: ${s.gacha.banners[gen]?.pity ?? 0}/${PITY}`
    one.disabled = spinning || tickets(s.gacha) < 1; ten.disabled = spinning || tickets(s.gacha) < 10; bundle.disabled = spinning || bundleTickets(s.gacha) < 1
    region.disabled = spinning
    prizes.replaceChildren(...bannerPool(gen).filter((id) => bannerRarity(id, gen) === 5).slice(0, 5).map((id) => h('div', {}, h('img', { src: portraitUrl(PLAYABLE[id].line[0].dex), alt: PLAYABLE[id].name }), h('span', {}, PLAYABLE[id].name))))
  }
  const draw = (count: 1 | 10, useBundle = false) => {
    if (spinning || disposed) return
    const entropy = new Uint32Array(1); crypto.getRandomValues(entropy)
    const out = pullGacha(loadSave(), count, Number(region.value), createRng(entropy[0]!), useBundle)
    if (!out) return
    writeSave(out.save)
    spinning = true
    results.replaceChildren()
    const pool = bannerPool(Number(region.value))
    const winner = out.pulls[0]!
    const finalIndex = 30
    const strip = h('div', { class: 'gacha-reel' }, ...Array.from({ length: finalIndex + 3 }, (_, i) => {
      const id = i === finalIndex ? winner.id : pool[(i * 17 + entropy[0]!) % pool.length]!
      return h('div', { class: 'gacha-reel-slot' }, h('img', { src: portraitUrl(PLAYABLE[id].line[0].dex, i === finalIndex && winner.shiny), alt: PLAYABLE[id].name }), h('span', {}, PLAYABLE[id].name))
    }))
    wheel.replaceChildren(strip); wheel.classList.remove('hidden'); skip.classList.remove('hidden')
    reveal = () => {
      if (!spinning || disposed) return
      clearTimeout(timer); strip.getAnimations().forEach((a) => a.cancel())
      spinning = false; reveal = null
      wheel.classList.add('hidden'); skip.classList.add('hidden')
      results.replaceChildren(...out.pulls.map((p, i) => h('div', { class: `gacha-card box rarity-${p.rarity}`, style: `animation-delay:${i * 70}ms` },
      h('img', { src: portraitUrl(PLAYABLE[p.id].line[0].dex, p.shiny), alt: PLAYABLE[p.id].name }), h('b', {}, PLAYABLE[p.id].name), h('span', {}, '★'.repeat(p.rarity)),
      h('span', {}, p.shiny ? `✨ ${m.shiny}` : m.normal), h('small', {}, p.fresh ? m.new : `+₽${p.refund}`))))
      refresh()
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) reveal()
    else {
      strip.animate([{ transform: 'translateX(0)' }, { transform: `translateX(-${finalIndex * 120}px)` }], { duration: 2800, easing: 'cubic-bezier(.12,.7,.12,1)', fill: 'forwards' })
      timer = setTimeout(() => reveal?.(), 2900)
    }
    refresh()
  }
  region.onchange = refresh
  const el = h('div', { class: 'screen feature-screen' }, h('div', { class: 'feature-panel box' }, h('h1', {}, m.gacha), balance, region, prizes,
    h('p', {}, m.gachaInfo), h('p', {}, m.guarantee), h('small', {}, m.odds), pity, h('div', { class: 'buttons' }, one, ten, bundle), wheel, skip, results, h('button', { class: 'btn', onclick: back }, m.back)))
  const off = input.onKey((k) => { if (k === 'Escape') later(back) })
  root.append(el); refresh()
  return { el, dispose: () => { disposed = true; clearTimeout(timer); reveal = null; off(); el.remove() } }
}
