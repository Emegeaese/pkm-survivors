import { describe, expect, it } from 'vitest'
import { createTitleScene, meetPartner, steerPartner, stepTitleScene, takeWalked } from './titleScene'

describe('the lobby partner on the meadow', () => {
  it('counts the distance it walks, once, for the eggs', () => {
    const scene = createTitleScene(1)
    meetPartner(scene, { dex: 25, shiny: false })
    for (let i = 0; i < 60; i++) {
      steerPartner(scene, { x: 1, y: 0 }, null, { x: 100, y: 100 })
      stepTitleScene(scene, 1 / 60, 480, 270)
    }
    const walked = takeWalked(scene)
    expect(walked).toBeGreaterThan(30)
    expect(walked).toBeLessThan(80)
    expect(takeWalked(scene)).toBe(0)
  })

  it('counts nothing while it stands on its stage', () => {
    const scene = createTitleScene(1)
    meetPartner(scene, { dex: 25, shiny: false })
    for (let i = 0; i < 60; i++) {
      steerPartner(scene, { x: 0, y: 0 }, null, { x: 100, y: 100 })
      stepTitleScene(scene, 1 / 60, 480, 270)
    }
    expect(takeWalked(scene)).toBe(0)
  })
})
