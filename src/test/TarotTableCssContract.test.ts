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
  it('anchors the desktop actions to projected tabletop bounds instead of stage corners', () => {
    const surfaceActions = cssRule('.tarot-table-surface-actions')
    const action = cssRule('.tarot-table-action')
    const collapse = cssRule('.tarot-table-action--collapse')
    const returnAll = cssRule('.tarot-table-action--return-all')

    expect(surfaceActions).toContain('position: absolute')
    expect(surfaceActions).toContain('var(--tarot-table-top')
    expect(surfaceActions).toContain('var(--tarot-table-side-inset')
    expect(surfaceActions).toContain('transform: translateY(-0.5rem)')
    expect(surfaceActions).toContain('pointer-events: none')
    expect(surfaceActions).not.toMatch(/(?:^|\n)\s*inset:\s*0\b/)
    expect(surfaceActions).not.toMatch(/(?:^|\n)\s*(?:left|right):\s*0\b/)

    expect(action).toContain('position: absolute')
    expect(action).toMatch(/(?:^|\n)\s*top:\s*0\s*;/)
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
    expect(reveal).toMatch(/(?:^|\n)\s*left:\s*50%\s*;/)
    expect(reveal).toMatch(/(?:^|\n)\s*right:\s*auto\s*;/)
    expect(reveal).toContain('transform: translateX(-50%)')
    expect(reveal).toContain('width: min(var(--tarot-reveal-width), calc(100% - 1rem))')
    expect(reveal).toContain('--tarot-reveal-width: clamp(16rem, 23vw, 20rem)')
    expect(reveal).not.toMatch(/(?:^|\n)\s*top:\s*0(?:\.|\s|;)/)
    expect(dockWhileRevealIsAvailable).toContain('visibility: hidden')
    expect(dockWhileRevealIsAvailable).toContain('pointer-events: none')
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
