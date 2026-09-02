import * as THREE from 'three'

export interface TarotAssetManifest {
  table: string
  cardBack: string
  pawOpen: string
  pawGrab: string
  pawPlace: string
  magicRing: string
  magicParticle: string
  slotFrame: string
  cardFront: (cardId: string) => string
}

export type TarotAssetOverrides = Partial<
  Omit<TarotAssetManifest, 'cardFront'>
> & {
  cardFront?: TarotAssetManifest['cardFront']
}

function withBaseUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.endsWith('/') ? base : `${base}/`}${relativePath.replace(/^\/+/, '')}`
}

export const DEFAULT_TAROT_ASSETS: TarotAssetManifest = {
  table: withBaseUrl('assets/tarot/table.webp'),
  cardBack: withBaseUrl('assets/tarot/card-back.webp'),
  pawOpen: withBaseUrl('assets/tarot/paw-open-v2.webp'),
  pawGrab: withBaseUrl('assets/tarot/paw-grab-v2.webp'),
  pawPlace: withBaseUrl('assets/tarot/paw-place-v1.webp'),
  magicRing: withBaseUrl('assets/tarot/magic-ring.webp'),
  magicParticle: withBaseUrl('assets/tarot/magic-spark.webp'),
  slotFrame: withBaseUrl('assets/tarot/slot-frame.webp'),
  cardFront: (cardId) =>
    withBaseUrl(`assets/tarot/cards/${encodeURIComponent(cardId)}.webp`),
}

export function resolveTarotAssets(
  overrides: TarotAssetOverrides = {},
): TarotAssetManifest {
  return {
    ...DEFAULT_TAROT_ASSETS,
    ...overrides,
    cardFront: overrides.cardFront ?? DEFAULT_TAROT_ASSETS.cardFront,
  }
}

function makeCanvasTexture(
  width: number,
  height: number,
  painter: (context: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (context) painter(context)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

export function createFallbackTableTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(512, 288, (context) => {
    const gradient = context.createRadialGradient(256, 130, 20, 256, 144, 320)
    gradient.addColorStop(0, '#233c3a')
    gradient.addColorStop(0.55, '#132b2b')
    gradient.addColorStop(1, '#071414')
    context.fillStyle = gradient
    context.fillRect(0, 0, 512, 288)
    context.globalAlpha = 0.16
    context.strokeStyle = '#c9a968'
    context.lineWidth = 2
    context.strokeRect(18, 18, 476, 252)
    context.globalAlpha = 0.07
    for (let y = 0; y < 288; y += 8) {
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(512, y + 18)
      context.stroke()
    }
  })
}

export function createFallbackCardBackTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(256, 448, (context) => {
    const gradient = context.createLinearGradient(0, 0, 256, 448)
    gradient.addColorStop(0, '#402854')
    gradient.addColorStop(0.5, '#172f3d')
    gradient.addColorStop(1, '#17111f')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 448)
    context.strokeStyle = '#ead59a'
    context.lineWidth = 8
    context.strokeRect(13, 13, 230, 422)
    context.lineWidth = 2
    context.strokeRect(27, 27, 202, 394)
    context.translate(128, 224)
    context.rotate(Math.PI / 4)
    context.strokeStyle = 'rgba(234, 213, 154, .74)'
    context.lineWidth = 5
    context.strokeRect(-62, -62, 124, 124)
    context.beginPath()
    context.arc(0, 0, 47, 0, Math.PI * 2)
    context.stroke()
  })
}

export function createFallbackCardFrontTexture(
  label = 'TAROT',
): THREE.CanvasTexture {
  return makeCanvasTexture(256, 448, (context) => {
    const gradient = context.createLinearGradient(0, 0, 0, 448)
    gradient.addColorStop(0, '#f1dfb2')
    gradient.addColorStop(1, '#aa7b4d')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 448)
    context.strokeStyle = '#372238'
    context.lineWidth = 8
    context.strokeRect(13, 13, 230, 422)
    context.fillStyle = '#372238'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '700 24px sans-serif'
    context.fillText(label.slice(0, 18), 128, 224)
  })
}

export function createFallbackSlotTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(256, 448, (context) => {
    context.clearRect(0, 0, 256, 448)
    context.strokeStyle = 'rgba(236, 215, 157, .8)'
    context.lineWidth = 6
    context.setLineDash([15, 12])
    context.strokeRect(12, 12, 232, 424)
    context.setLineDash([])
    context.beginPath()
    context.arc(128, 224, 42, 0, Math.PI * 2)
    context.stroke()
  })
}

export function createFallbackPawTexture(grabbing: boolean): THREE.CanvasTexture {
  return makeCanvasTexture(256, 256, (context) => {
    context.clearRect(0, 0, 256, 256)
    const pad = grabbing ? '#715048' : '#8f6658'
    const fur = '#d7c7b9'
    context.fillStyle = fur
    context.beginPath()
    context.ellipse(128, 158, grabbing ? 63 : 72, grabbing ? 58 : 68, 0, 0, Math.PI * 2)
    context.fill()
    for (const [x, y] of [
      [75, 83],
      [111, 64],
      [150, 67],
      [184, 91],
    ]) {
      context.beginPath()
      context.ellipse(x, y, grabbing ? 23 : 27, grabbing ? 31 : 36, 0, 0, Math.PI * 2)
      context.fill()
    }
    context.fillStyle = pad
    context.beginPath()
    context.ellipse(128, 164, 38, 32, 0, 0, Math.PI * 2)
    context.fill()
  })
}

export function createFallbackParticleTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(64, 64, (context) => {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255,255,236,1)')
    gradient.addColorStop(0.18, 'rgba(255,220,133,.96)')
    gradient.addColorStop(0.55, 'rgba(118,232,207,.45)')
    gradient.addColorStop(1, 'rgba(118,232,207,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 64, 64)
  })
}

export function createFallbackMagicRingTexture(): THREE.CanvasTexture {
  return makeCanvasTexture(256, 256, (context) => {
    context.clearRect(0, 0, 256, 256)
    context.translate(128, 128)
    context.strokeStyle = 'rgba(247, 218, 142, .94)'
    context.lineWidth = 5
    context.beginPath()
    context.arc(0, 0, 102, 0, Math.PI * 2)
    context.stroke()
    context.lineWidth = 2
    context.beginPath()
    context.arc(0, 0, 78, 0, Math.PI * 2)
    context.stroke()
    for (let index = 0; index < 12; index += 1) {
      context.rotate(Math.PI / 6)
      context.beginPath()
      context.moveTo(0, -112)
      context.lineTo(8, -93)
      context.lineTo(-8, -93)
      context.closePath()
      context.stroke()
    }
  })
}

export interface LoadTextureOptions {
  colorSpace?: THREE.ColorSpace
  onLoad?: (texture: THREE.Texture) => void
}

export function loadTextureInto(
  loader: THREE.TextureLoader,
  url: string,
  options: LoadTextureOptions = {},
): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        texture.needsUpdate = true
        options.onLoad?.(texture)
        resolve(texture)
      },
      undefined,
      () => resolve(null),
    )
  })
}
