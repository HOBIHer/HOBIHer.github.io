import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sceneSource = readFileSync(
  resolve(process.cwd(), 'src', 'tarot', 'TarotScene.ts'),
  'utf8',
)

function markedMethodSource(marker: string, name: string): string {
  const methodStart = sceneSource.indexOf(marker)
  if (methodStart < 0) throw new Error(`Missing TarotScene method: ${name}`)

  const bodyStart = sceneSource.indexOf('{', methodStart)
  if (bodyStart < 0) throw new Error(`Missing TarotScene method body: ${name}`)

  let depth = 0
  for (let index = bodyStart; index < sceneSource.length; index += 1) {
    const character = sceneSource[index]
    if (character === '{') depth += 1
    if (character !== '}') continue
    depth -= 1
    if (depth === 0) return sceneSource.slice(methodStart, index + 1)
  }

  throw new Error(`Unterminated TarotScene method body: ${name}`)
}

function privateMethodSource(name: string): string {
  return markedMethodSource(`private ${name}(`, name)
}

function publicMethodSource(name: string): string {
  return markedMethodSource(`  ${name}(`, name)
}

describe('TarotScene interaction policy source contract', () => {
  it('keeps ready behind the complete startup texture barrier and reports progress', () => {
    const mountMethod = publicMethodSource('mount')
    const loadMethod = markedMethodSource(
      'private async loadGeneratedTextures(',
      'loadGeneratedTextures',
    )
    const snapshotMethod = publicMethodSource('getSnapshot')
    const loadStart = mountMethod.indexOf('void this.loadGeneratedTextures()')
    const readyStart = mountMethod.indexOf('this.ready = true')

    expect(loadStart).toBeGreaterThanOrEqual(0)
    expect(readyStart).toBeGreaterThan(loadStart)
    expect(mountMethod.slice(0, loadStart)).not.toContain('this.ready = true')
    expect(mountMethod).toContain('STARTUP_SHARED_ASSET_COUNT + this.cards.length')
    expect(mountMethod).toContain('this.preloadAssetUrls.length')
    expect(mountMethod).toMatch(/this\.renderer\.render\(this\.scene, this\.camera\)[\s\S]*this\.ready = true/)

    expect(loadMethod).toContain('this.cards.map((card) =>')
    expect(loadMethod).toContain('this.ensureFrontTexture(card).finally')
    expect(loadMethod).toContain('this.preloadAssetUrls.map')
    expect(loadMethod).toContain('this.markStartupAssetSettled()')
    expect(snapshotMethod).toContain('loadingProgress:')
    expect(snapshotMethod).toContain('loadedAssets: this.loadedAssets')
    expect(snapshotMethod).toContain('totalAssets: this.totalAssets')
  })

  it('uses a deliberate but still short hold threshold before starting a drag', () => {
    const duration = Number(
      sceneSource.match(/const CARD_HOLD_DURATION_MS = (\d+)/)?.[1],
    )
    const reducedDuration = Number(
      sceneSource.match(/const CARD_HOLD_REDUCED_MOTION_DURATION_MS = (\d+)/)?.[1],
    )
    const holdMethod = privateMethodSource('startCardHold')
    const completionMethod = privateMethodSource('completePendingCardHold')

    expect(duration).toBeGreaterThanOrEqual(500)
    expect(duration).toBeLessThanOrEqual(600)
    expect(reducedDuration).toBeGreaterThanOrEqual(450)
    expect(reducedDuration).toBeLessThanOrEqual(duration)
    expect(holdMethod).toContain('CARD_HOLD_DURATION_MS')
    expect(holdMethod).toContain('CARD_HOLD_REDUCED_MOTION_DURATION_MS')
    expect(completionMethod).toContain('this.startDrag(pending.card, pending.pointerId)')
  })

  it('delays the hold progress ring briefly instead of flashing it on pointer down', () => {
    const indicatorDelay = Number(
      sceneSource.match(/const CARD_HOLD_INDICATOR_DELAY_MS = (\d+)/)?.[1],
    )
    const holdMethod = privateMethodSource('startCardHold')
    const updateMethod = privateMethodSource('updatePendingCardHold')

    expect(indicatorDelay).toBeGreaterThanOrEqual(100)
    expect(indicatorDelay).toBeLessThanOrEqual(200)
    expect(holdMethod).toContain('this.holdIndicator.sprite.visible = false')
    expect(updateMethod).toContain('elapsed >= CARD_HOLD_INDICATOR_DELAY_MS')
    expect(updateMethod).toContain('elapsed - CARD_HOLD_INDICATOR_DELAY_MS')
  })

  it('uses a stronger bounded held-card tremble and restores it on cancel or completion', () => {
    const visualMethod = privateMethodSource('updateCardVisuals')
    const cancelMethod = privateMethodSource('cancelPendingCardHold')
    const completionMethod = privateMethodSource('completePendingCardHold')
    const restoreMethod = privateMethodSource('restoreHeldCardVisual')
    const amplitudes = [
      visualMethod.match(/flipGroup\.position\.x\s*=.*?\*\s*(0\.\d+)\s*\*\s*strength/)?.[1],
      visualMethod.match(/flipGroup\.position\.z\s*=.*?\*\s*(0\.\d+)\s*\*\s*strength/)?.[1],
      visualMethod.match(/flipGroup\.rotation\.y\s*=.*?\*\s*(0\.\d+)\s*\*\s*strength/)?.[1],
    ].map(Number)
    const [xAmplitude, zAmplitude, rotationAmplitude] = amplitudes

    expect(visualMethod).toContain('const heldCard = this.pendingCardHold?.card ?? null')
    expect(xAmplitude).toBeGreaterThan(0.011)
    expect(xAmplitude).toBeLessThanOrEqual(0.03)
    expect(zAmplitude).toBeGreaterThan(0.006)
    expect(zAmplitude).toBeLessThanOrEqual(0.02)
    expect(rotationAmplitude).toBeGreaterThan(0.0045)
    expect(rotationAmplitude).toBeLessThanOrEqual(0.015)
    expect(visualMethod).toContain('this.restoreHeldCardVisual(card)')
    expect(cancelMethod).toContain('this.restoreHeldCardVisual(heldCard)')
    expect(completionMethod).toContain('this.restoreHeldCardVisual(pending.card)')
    expect(restoreMethod).toContain('card.flipGroup.position.x = 0')
    expect(restoreMethod).toContain('card.flipGroup.position.z = 0')
    expect(restoreMethod).toContain('card.flipGroup.rotation.y = 0')
  })

  it('adds a generated-frame highlight only to the card currently charging', () => {
    const initializeMethod = privateMethodSource('initializeEffects')
    const holdMethod = privateMethodSource('startCardHold')
    const prepareMethod = privateMethodSource('prepareHoldHighlight')
    const updateMethod = privateMethodSource('updateHoldHighlight')
    const restoreMethod = privateMethodSource('restoreHeldCardVisual')
    const destroyMethod = publicMethodSource('destroy')
    const loadMethod = markedMethodSource(
      'private async loadGeneratedTextures(',
      'loadGeneratedTextures',
    )

    expect(initializeMethod).toContain('this.shared.fallbackSlotTexture')
    expect(initializeMethod).toContain('blending: THREE.AdditiveBlending')
    expect(holdMethod).toContain('this.prepareHoldHighlight(card)')
    expect(prepareMethod).toContain('card.root.add(highlight.mesh)')
    expect(updateMethod).toContain('CARD_HOLD_INDICATOR_DELAY_MS')
    expect(updateMethod).toContain('highlight.mesh.visible = progress > 0.001')
    expect(updateMethod).toContain('this.reducedMotion ? 0')
    expect(restoreMethod).toContain('this.holdHighlight.mesh.visible = false')
    expect(restoreMethod).toContain('this.holdHighlight.material.opacity = 0')
    expect(destroyMethod).toContain('this.holdHighlight?.material.dispose()')
    expect(loadMethod).toContain('this.holdHighlight.material.map = slot')
    expect(updateMethod).not.toContain('this.shared.backMaterial')
  })

  it('scales card visuals and hit bodies together while preserving their aspect ratio', () => {
    const width = Number(sceneSource.match(/const CARD_WIDTH = (\d+)/)?.[1])
    const height = Number(sceneSource.match(/const CARD_HEIGHT = (\d+)/)?.[1])
    const initializeMethod = privateMethodSource('initializeThree')
    const cardsMethod = privateMethodSource('initializeCards')

    expect(width).toBeGreaterThan(96)
    expect(height).toBeGreaterThan(168)
    expect(height / width).toBeCloseTo(7 / 4, 5)
    expect(initializeMethod).toContain('CARD_WORLD_WIDTH, CARD_WORLD_HEIGHT')
    expect(cardsMethod).toContain('CARD_HULL_WIDTH')
    expect(cardsMethod).toContain('CARD_HULL_HEIGHT')
  })

  it('keeps the paw horizontally aligned with pointer, drag, and placement targets', () => {
    const pawMethod = privateMethodSource('updatePaw')
    const cameraRightOffset = pawMethod.match(
      /target\.addScaledVector\(cameraRight,\s*([^\n)]+)\)/,
    )?.[1]

    expect(pawMethod).not.toMatch(/target\.x\s*[+-]=/)

    if (cameraRightOffset === undefined) {
      // Exact alignment is the preferred zero-offset implementation. Depth or
      // height adjustments, including towardCamera, remain outside this rule.
      expect(pawMethod).not.toContain('cameraRight')
      return
    }

    const offsets = cameraRightOffset.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    const pointerFallback = Number(
      cameraRightOffset.match(/:\s*(-?\d+(?:\.\d+)?)\s*$/)?.[1],
    )

    expect(offsets.length).toBeGreaterThan(0)
    for (const offset of offsets) expect(Math.abs(offset)).toBeLessThanOrEqual(0.12)
    expect(pointerFallback).toBeLessThanOrEqual(0)
  })

  it('keeps the paw hidden from pinch start until every touch has ended', () => {
    const pinchMethod = privateMethodSource('startFanPinch')
    const pawMethod = privateMethodSource('updatePaw')
    const pointerMethod = privateMethodSource('updatePointer')
    const restoreMethod = privateMethodSource('restorePawAfterTouchGesture')
    const pointerUpMethod = privateMethodSource('handlePointerUp')
    const pointerCancelMethod = privateMethodSource('handlePointerCancel')
    const lostCaptureMethod = privateMethodSource('handleLostPointerCapture')

    expect(pinchMethod).toContain('this.suppressPawUntilTouchesEnd = true')
    expect(pinchMethod).toContain('this.pointerVisible = false')
    expect(pinchMethod).toContain('this.pointerVelocityX = 0')
    expect(pawMethod).toContain('if (this.suppressPawUntilTouchesEnd)')
    expect(pawMethod).toContain('this.paw.visible = false')
    expect(pointerMethod).toContain(
      'if (!this.suppressPawUntilTouchesEnd) this.pointerVisible = true',
    )
    expect(restoreMethod).toContain("if (pointerType !== 'touch') return")
    expect(restoreMethod).toContain("pointer.pointerType === 'touch'")
    expect(restoreMethod).toMatch(/if \(hasActiveTouches\) return[\s\S]*this\.suppressPawUntilTouchesEnd = false/)
    expect(pointerUpMethod).toContain('this.restorePawAfterTouchGesture(event.pointerType)')
    expect(pointerCancelMethod).toContain('this.restorePawAfterTouchGesture(event.pointerType)')
    expect(lostCaptureMethod).toContain('this.restorePawAfterTouchGesture(event.pointerType)')
  })

  it('blocks native selection and long-press menus on the WebGL table', () => {
    const initializeMethod = privateMethodSource('initializeThree')
    const bindMethod = privateMethodSource('bindEvents')
    const unbindMethod = privateMethodSource('unbindEvents')

    expect(initializeMethod).toContain("canvas.style.setProperty('-webkit-user-select', 'none')")
    expect(initializeMethod).toContain("canvas.style.setProperty('-webkit-touch-callout', 'none')")
    for (const eventName of ['selectstart', 'contextmenu', 'dragstart']) {
      expect(bindMethod).toContain(`canvas.addEventListener('${eventName}'`)
      expect(unbindMethod).toContain(`canvas?.removeEventListener('${eventName}'`)
    }
    expect(bindMethod).toMatch(
      /canvas\.addEventListener\('touchstart',[\s\S]*?passive: false/,
    )
    expect(unbindMethod).toContain("canvas?.removeEventListener('touchstart'")
  })

  it('renders the space beyond the tabletop as pure black', () => {
    const initializeMethod = privateMethodSource('initializeThree')

    expect(initializeMethod).toContain('scene.background = new THREE.Color(0x000000)')
  })

  it('preserves zoom and pan when a card is selected', () => {
    const startDragMethod = privateMethodSource('startDrag')

    expect(startDragMethod).not.toContain('resetFanState')
    expect(startDragMethod).not.toContain('resetFanViewport')
    expect(startDragMethod).not.toMatch(/fanZoom\s*=/)
    expect(startDragMethod).not.toMatch(/fanPanX\s*=/)
  })

  it('allows a cropped fan to pan at base zoom without stealing a stationary hold', () => {
    const pointerDownMethod = privateMethodSource('handlePointerDown')
    const pointerMoveMethod = privateMethodSource('handlePointerMove')
    const canPanMethod = privateMethodSource('canPanFan')
    const panRangeMethod = privateMethodSource('getCurrentFanPanRange')

    expect(pointerDownMethod).toContain("this.mode === 'fan' && this.canPanFan()")
    expect(pointerMoveMethod).toContain('this.canPanFan()')
    expect(pointerMoveMethod).toContain('distance <= CARD_HOLD_MOVE_THRESHOLD_PX')
    expect(pointerMoveMethod).toContain("pending.card.state === 'fan-anchored'")
    expect(pointerDownMethod).not.toContain('this.fanZoom > 1.001')
    expect(pointerMoveMethod).not.toContain('this.fanZoom > 1.001')
    expect(canPanMethod).toContain('panRange.min < -0.001')
    expect(canPanMethod).toContain('panRange.max > 0.001')
    expect(panRangeMethod).toContain('PHONE_FAN_VIEWPORT_CENTER_WIDTH')
  })

  it('resets the fan viewport only when cards truly collapse', () => {
    const collapseMethod = privateMethodSource('collapseUnlockedCards')
    const resetCalls = sceneSource.match(/this\.resetFanState\(\)/g) ?? []

    expect(collapseMethod).toContain('this.resetFanState()')
    expect(resetCalls).toHaveLength(1)
  })

  it('auto-collapses only after every slot in a multi-card spread is filled', () => {
    const snapMethod = privateMethodSource('updateSnapTweens')

    expect(snapMethod).toContain(
      'this.currentSpread.slots.every((slot) => this.placedBySlot.has(slot.id))',
    )
    expect(snapMethod).toMatch(
      /this\.snapTweens\.size === 0 && this\.mode === 'fan' && spreadComplete/,
    )
    expect(snapMethod).toContain('void this.collapseUnlockedCards()')
  })

  it('returns placed and revealed cards to one face-down stack without changing collapse semantics', () => {
    const returnAllMethod = publicMethodSource('returnAllCardsToStack')
    const collapseMethod = privateMethodSource('collapseUnlockedCards')

    expect(returnAllMethod).toContain('if (hadPlacedCards) this.releasePlacedCards()')
    expect(returnAllMethod).toContain('for (const card of this.cards) card.flipTarget = 0')
    expect(returnAllMethod).toMatch(/if \(hadPlacedCards\) \{\s*this\.emitSnapshot\(\)/)
    expect(returnAllMethod).toContain('return this.collapseUnlockedCards()')
    expect(collapseMethod).toContain(
      "this.cards.filter((card) => card.state !== 'slot-locked')",
    )
  })

  it('animates stacked spread resets while preserving an open fan', () => {
    const resetMethod = publicMethodSource('resetSpread')
    const snapshotMethod = publicMethodSource('getSnapshot')

    expect(resetMethod).toContain("if (this.mode === 'fan') return this.repair()")
    expect(resetMethod).toContain(
      'new Map(releasedCards.map((card) => [card.data.id, card.stackPose]))',
    )
    expect(resetMethod).toContain("this.setMode('collapsing')")
    expect(resetMethod).toContain('this.startMagic(this.getDeckCenter()')
    expect(resetMethod).toMatch(
      /return this\.beginTransition\('collapse', releasedCards, targets, \(\) => \{\s*for \(const card of releasedCards\) this\.stackCard\(card\)\s*this\.setMode\('stacked'\)\s*\}\)/,
    )
    expect(resetMethod).not.toContain('return Promise.resolve(true)')

    expect(snapshotMethod).toMatch(/const idle =\s*this\.transition === null &&/)
    expect(snapshotMethod).toContain(
      'canResetSpread: this.ready && this.placedBySlot.size > 0 && idle',
    )
  })

  it('publishes the projected tabletop bounds for DOM controls and clears them on destroy', () => {
    const resizeMethod = privateMethodSource('resize')
    const destroyMethod = publicMethodSource('destroy')

    expect(resizeMethod.match(/\.project\(this\.camera\)/g)).toHaveLength(2)
    expect(resizeMethod).toContain('const tableTop = clamp(((1 - farLeft.y) / 2) * height')
    expect(resizeMethod).toContain('Math.min(projectedLeft, width - projectedRight)')
    expect(resizeMethod).toContain("this.container.closest<HTMLElement>('.tarot-table-stage')")
    expect(resizeMethod).toContain("style.setProperty('--tarot-table-top'")
    expect(resizeMethod).toContain("'--tarot-table-side-inset'")
    expect(destroyMethod).toContain("style.removeProperty('--tarot-table-top')")
    expect(destroyMethod).toContain("style.removeProperty('--tarot-table-side-inset')")
  })

  it('uses the compact phone composition for the camera, deck, spread, and fan viewport', () => {
    const resizeMethod = privateMethodSource('resize')
    const stackMethod = privateMethodSource('initializeCards')
    const fanPanRangeMethod = privateMethodSource('getCurrentFanPanRange')
    const spreadGeometryMethod = privateMethodSource('getSpreadGeometry')
    const deckCenterMethod = privateMethodSource('getDeckCenter')

    expect(resizeMethod).toContain('getTarotViewportComposition(width, height)')
    expect(resizeMethod).toContain('composition.distanceScale')
    expect(resizeMethod).toContain('composition.lookAtY')
    expect(stackMethod).toContain('center: this.getDeckCenter()')
    expect(fanPanRangeMethod).toContain('PHONE_FAN_VIEWPORT_CENTER_WIDTH')
    expect(spreadGeometryMethod).toContain('PHONE_SPREAD_ORIGIN')
    expect(spreadGeometryMethod).toContain('PHONE_SPREAD_TABLE_SIZE')
    expect(deckCenterMethod).toContain('PHONE_DECK_CENTER')
  })
})
