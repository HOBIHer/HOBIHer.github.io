import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const tableCss = readFileSync(
  resolve(process.cwd(), 'src', 'styles', 'tarot-table.css'),
  'utf8',
)

function cssRule(selector: string): string {
  const marker = `${selector} {`
  const ruleStart = tableCss.indexOf(marker)
  if (ruleStart < 0) throw new Error(`Missing CSS rule: ${selector}`)

  const bodyStart = tableCss.indexOf('{', ruleStart)
  const bodyEnd = tableCss.indexOf('}', bodyStart)
  if (bodyStart < 0 || bodyEnd < 0) throw new Error(`Unterminated CSS rule: ${selector}`)
  return tableCss.slice(bodyStart + 1, bodyEnd)
}

function cssRuleAfter(selector: string, marker: string): string {
  const markerStart = tableCss.indexOf(marker)
  if (markerStart < 0) throw new Error(`Missing CSS marker: ${marker}`)

  const ruleStart = tableCss.indexOf(`${selector} {`, markerStart)
  if (ruleStart < 0) throw new Error(`Missing CSS rule after ${marker}: ${selector}`)

  const bodyStart = tableCss.indexOf('{', ruleStart)
  const bodyEnd = tableCss.indexOf('}', bodyStart)
  if (bodyStart < 0 || bodyEnd < 0) throw new Error(`Unterminated CSS rule: ${selector}`)
  return tableCss.slice(bodyStart + 1, bodyEnd)
}

describe('Tarot table DOM control projection CSS contract', () => {
  it('uses a black void around the table and disables native selection gestures', () => {
    const page = cssRule('.tarot-page')
    const workspace = cssRule('.tarot-workspace')
    const stage = cssRule('.tarot-table-stage')
    const interactionRule = cssRule('.tarot-table-stage *')
    const canvas = cssRule('.tarot-scene-host canvas')

    expect(page).toContain('--tarot-bg: #000')
    expect(page).toContain('background: var(--tarot-bg)')
    expect(workspace).toContain('background: #000')
    expect(stage).toContain('background: #000')
    expect(interactionRule).toContain('-webkit-user-select: none')
    expect(interactionRule).toContain('user-select: none')
    expect(interactionRule).toContain('-webkit-touch-callout: none')
    expect(tableCss).toMatch(/\.tarot-scene-host \{\s*touch-action: none;/)
    expect(canvas).toContain('touch-action: none')
  })

  it('places all three controls above the projected table in a centered triangle', () => {
    const tools = cssRuleAfter('.tarot-table-tools', '.tarot-scene-host canvas')
    const surfaceActions = cssRule('.tarot-table-surface-actions')
    const action = cssRule('.tarot-table-action')
    const collapse = cssRule('.tarot-table-action--collapse')
    const returnAll = cssRule('.tarot-table-action--return-all')

    expect(surfaceActions).toContain('position: absolute')
    expect(surfaceActions).toContain('var(--tarot-table-top')
    expect(tools).toContain('--tarot-action-width:')
    expect(tools).toContain('--tarot-action-height:')
    expect(tools).toContain('--tarot-reveal-height:')
    expect(surfaceActions).toContain('- var(--tarot-action-height)')
    expect(surfaceActions).toMatch(/(?:^|\n)\s*left:\s*50%\s*;/)
    expect(surfaceActions).toMatch(/(?:^|\n)\s*right:\s*auto\s*;/)
    expect(surfaceActions).toContain('transform: translateX(-50%)')
    expect(surfaceActions).toContain('pointer-events: none')
    expect(surfaceActions).not.toMatch(/(?:^|\n)\s*inset:\s*0\b/)

    expect(action).toContain('position: absolute')
    expect(action).toMatch(/(?:^|\n)\s*top:\s*0\s*;/)
    expect(action).toContain('width: var(--tarot-action-width)')
    expect(action).toContain('height: var(--tarot-action-height)')
    expect(action).toContain('pointer-events: auto')
    expect(collapse).toMatch(/(?:^|\n)\s*left:\s*0\s*;/)
    expect(returnAll).toMatch(/(?:^|\n)\s*right:\s*0\s*;/)
  })

  it('centers the larger reveal artwork directly above the projected tabletop frame', () => {
    const reveal = cssRule('.tarot-table-reveal')
    const dockWhileRevealIsAvailable = cssRule(
      '.tarot-table-tools.has-reveal-control .tarot-spread-dock',
    )

    expect(reveal).toContain('var(--tarot-table-top')
    expect(reveal).toContain('- var(--tarot-action-height)')
    expect(reveal).toContain('var(--tarot-command-overlap)')
    expect(reveal).toMatch(/(?:^|\n)\s*left:\s*50%\s*;/)
    expect(reveal).toMatch(/(?:^|\n)\s*right:\s*auto\s*;/)
    expect(reveal).toContain('transform: translateX(-50%)')
    expect(reveal).toContain('width: min(var(--tarot-reveal-width), calc(100% - 1rem))')
    expect(reveal).not.toMatch(/(?:^|\n)\s*top:\s*0(?:\.|\s|;)/)
    expect(dockWhileRevealIsAvailable).toContain('visibility: hidden')
    expect(dockWhileRevealIsAvailable).toContain('pointer-events: none')
  })

  it('widens the table stage and keeps responsive action sizing outside the cloth', () => {
    const workspace = cssRule('.tarot-workspace')
    const mobileMarker = '@media (max-width: 720px)'
    const mobileTools = cssRuleAfter('.tarot-table-tools', mobileMarker)
    const portraitOverride = tableCss.indexOf('@media (max-aspect-ratio: 5 / 4)')

    expect(workspace).toContain('width: min(100% - 1rem, 1800px)')
    expect(mobileTools).toContain('--tarot-action-width: min(')
    expect(mobileTools).toContain('--tarot-action-row-width: min(')
    expect(portraitOverride).toBe(-1)
  })

  it('uses an opaque full-stage loading curtain while the WebGL table stays measurable', () => {
    const loading = cssRule('.tarot-loading')
    const progress = cssRule('.tarot-loading__progress')
    const hiddenMarker = '.tarot-table-stage.is-loading .tarot-table-fallback,'
    const hiddenStart = tableCss.indexOf(hiddenMarker)
    const hiddenRule = tableCss.slice(hiddenStart, tableCss.indexOf('}', hiddenStart))

    expect(loading).toContain('z-index: 10')
    expect(loading).toMatch(/(?:^|\n)\s*inset:\s*0\s*;/)
    expect(loading).toContain('background: #000')
    expect(progress).toContain('width: 100%')
    expect(hiddenStart).toBeGreaterThanOrEqual(0)
    expect(hiddenRule).toContain('.tarot-table-stage.is-loading .tarot-scene-host')
    expect(hiddenRule).toContain('visibility: hidden')
    expect(hiddenRule).not.toContain('display: none')
  })

  it('gives revealed card faces more of the desktop dialog viewport', () => {
    const modal = cssRule('.tarot-page .modal')
    const modalBody = cssRule('.tarot-page .modal__body')
    const revealItem = cssRule('.tarot-reveal-list > li')
    const revealImage = cssRule('.tarot-reveal-list > li > img')

    expect(modal).toContain('width: min(100%, 64rem)')
    expect(modal).toContain('max-height: min(90dvh, 56rem)')
    expect(modalBody).toContain('max-height: calc(min(90dvh, 56rem) - 4rem)')
    expect(revealItem).toContain(
      '--tarot-revealed-card-width: clamp(11rem, 18vw, 15rem)',
    )
    expect(revealItem).toContain(
      'grid-template-columns: var(--tarot-revealed-card-width) minmax(0, 1fr)',
    )
    expect(revealImage).toMatch(/(?:^|\n)\s*width:\s*100%\s*;/)
  })

  it('stacks and centers revealed card faces on narrow phones', () => {
    const mobileMarker = '@media (max-width: 480px)'
    const revealItem = cssRuleAfter('.tarot-reveal-list > li', mobileMarker)
    const revealImage = cssRuleAfter('.tarot-reveal-list > li > img', mobileMarker)

    expect(revealItem).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(revealImage).toContain('width: min(52vw, 11rem)')
    expect(revealImage).toContain('justify-self: center')
  })
})
