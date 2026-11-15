import { describe, expect, it } from 'vitest'
import { CREW } from './catalog'
import { SIM, TIMELINE } from './config'
import { HealthEngine } from './engine'
import { DAY_MS, HOUR_MS, MIN_MS } from './text'

const FRAME = TIMELINE.frameEveryMin * MIN_MS

function run(e: HealthEngine, minutes: number, stepMin: number): void {
  const end = e.simTime + minutes * MIN_MS
  while (e.simTime < end) {
    e.advanceTo(Math.min(end, e.simTime + stepMin * MIN_MS))
    e.evaluate()
  }
}

function checkGrid(frames: { t: number }[]): void {
  for (let i = 1; i < frames.length; i++) expect(frames[i]!.t - frames[i - 1]!.t).toBe(FRAME)
}

describe('status timeline', () => {
  it('covers the last 24 sim hours right after startup, every 15 min, ascending', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL' })
    const f = e.statusTimeline
    expect(f[0]!.t).toBeLessThanOrEqual(e.startedAt - 24 * HOUR_MS)
    expect(f[f.length - 1]!.t).toBe(e.startedAt)
    checkGrid(f)
    for (const fr of f) {
      expect(Object.keys(fr.levels).sort()).toEqual(['CABIN', ...CREW.map((a) => a.id)].sort())
    }
    expect(f.every((fr) => Object.values(fr.levels).every((l) => l === 'LOW' || l === 'MODERATE'))).toBe(true)
    // no new frame, same reference
    const ref = e.statusTimeline
    e.evaluate()
    expect(e.statusTimeline).toBe(ref)
  })

  it('appends live frames that follow the risk level, also when the sim jumps far ahead', () => {
    const e = new HealthEngine({ scenarioId: 'ACUTE_CARDIO' })
    run(e, 30, 1)
    const last = e.statusTimeline[e.statusTimeline.length - 1]!
    expect(last.t).toBe(e.startedAt + 30 * MIN_MS)
    expect(last.levels['AST-01']).toBe('CRITICAL')
    expect(last.levels['AST-02']).not.toBe('CRITICAL')
    // one big jump (like 86400x speed): every boundary still gets a frame
    e.advanceTo(e.simTime + 6 * HOUR_MS)
    e.evaluate()
    checkGrid(e.statusTimeline)
    expect(e.statusTimeline[e.statusTimeline.length - 1]!.t).toBe(e.simTime)
  })

  it('stays bounded to the history window', () => {
    const e = new HealthEngine({ scenarioId: 'NOMINAL', timelinePregenHours: 2 })
    run(e, 6 * 24 * 60, 120)
    const f = e.statusTimeline
    checkGrid(f)
    expect(f[f.length - 1]!.t - f[0]!.t).toBeLessThanOrEqual(SIM.historyDays * DAY_MS)
    expect(f.length).toBeLessThanOrEqual((SIM.historyDays * DAY_MS) / FRAME + 1)
  }, 60000)
})
