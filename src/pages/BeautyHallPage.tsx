import type { ChangeEvent, CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Eye,
  EyeOff,
  FileJson,
  ImagePlus,
  LockKeyhole,
  Plus,
  RefreshCcw,
  Save,
  Shield,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'hobiher-beauty-hall:v1'
const MAX_CARDS = 50
const DEFAULT_PASSWORD = 'hobiher'

interface HallPhoto {
  id: string
  dataUrl: string
  name: string
  createdAt: string
}

interface HallCardData {
  id: string
  name: string
  styleLabel: string
  avatarDataUrl?: string
  photos: HallPhoto[]
  secret: boolean
  backSeed: number
  paletteIndex: number
  createdAt: string
  updatedAt: string
}

interface HallSettings {
  password: string
  protectedTop: number
}

interface HallPayload {
  version: number
  exportedAt?: string
  cards: HallCardData[]
  settings: HallSettings
}

const beautySeeds = [
  ['洛璃', '月光古典'],
  ['绯奈', '玫瑰骑士'],
  ['青鸾', '东方青瓷'],
  ['艾薇', '银幕名伶'],
  ['星野澪', '霓虹偶像'],
  ['卡蜜拉', '黑金歌剧'],
  ['苏棠', '江南雨巷'],
  ['莉亚', '海盐假日'],
  ['伊莎贝尔', '宫廷油画'],
  ['沈知夏', '清冷学院'],
  ['娜塔莉', '午夜爵士'],
  ['白栀', '雪境精灵'],
  ['林鹿', '森系旅人'],
  ['阿黛尔', '红毯女王'],
  ['姜玥', '新中式绸缎'],
  ['米娅', '糖果流行'],
  ['叶千寻', '赛博玫瑰'],
  ['薇奥拉', '紫晶占星'],
  ['顾南星', '复古港风'],
  ['安妮塔', '地中海蓝'],
  ['秦昭昭', '明艳侠女'],
  ['诺拉', '北欧晨雾'],
  ['唐梨', '甜酷街拍'],
  ['奥菲莉娅', '湖畔诗人'],
  ['许愿', '云端芭蕾'],
  ['塞琳娜', '金色沙龙'],
  ['温遥', '竹影书卷'],
  ['玛格丽特', '古堡蔷薇'],
  ['周映雪', '冰蓝高定'],
  ['伊莲', '珍珠礼帽'],
  ['陆听澜', '深海长裙'],
  ['贝拉', '阳光画室'],
  ['钟灵', '琥珀茶会'],
  ['西尔维娅', '翡翠花园'],
  ['夏弥', '粉雾梦境'],
  ['罗莎琳', '金箔剧场'],
  ['顾朝颜', '牡丹国色'],
  ['尤娜', '未来银翼'],
  ['程晚照', '落日胶片'],
  ['海伦娜', '白塔圣歌'],
  ['秦桑', '墨色旗袍'],
  ['艾琳', '森林竖琴'],
  ['孟扶摇', '赤焰舞姬'],
  ['克莱尔', '法式花窗'],
  ['谢云雀', '轻纱晨风'],
  ['露西亚', '星河礼服'],
  ['阮星竹', '山茶清梦'],
  ['维多利亚', '皇冠蓝调'],
  ['鹿眠', '软白针织'],
  ['阿芙洛', '玫瑰神殿'],
] as const

const backPalettes = [
  ['#4d1f3f', '#d7a84d', '#ffe8ac', '#170b1a'],
  ['#123a45', '#77d6ad', '#d8f6ea', '#081519'],
  ['#2b214f', '#d498f3', '#efe0ff', '#110d1d'],
  ['#5b1f2c', '#f0b35a', '#ffe2a6', '#18090d'],
  ['#19365c', '#92b7ff', '#e5efff', '#071323'],
  ['#403014', '#e2c26b', '#fff0b8', '#151006'],
  ['#1d4a36', '#c9df78', '#f4ffd0', '#07160f'],
  ['#4c1730', '#ff9dbf', '#ffe4ee', '#180813'],
  ['#2f314f', '#b9bfe8', '#edf0ff', '#0f1020'],
  ['#4b2a18', '#f1a56e', '#ffe1c7', '#170c07'],
] as const

const portraitHairs = [
  'M20 92 C10 54 21 14 59 12 C96 10 111 51 100 93 C85 86 78 63 82 40 C70 50 47 50 35 39 C39 62 33 84 20 92Z',
  'M18 92 C12 57 22 17 57 14 C92 12 106 43 103 78 C99 96 83 101 72 92 C86 71 83 48 72 34 C62 48 42 52 31 43 C34 63 31 82 18 92Z',
  'M18 89 C19 43 37 15 65 17 C96 19 108 48 97 92 C89 82 88 62 90 43 C76 55 48 52 34 35 C36 60 31 82 18 89Z',
  'M17 90 C13 52 29 12 63 13 C94 14 111 47 101 88 C90 95 76 91 68 81 C83 58 81 40 66 30 C51 45 36 48 28 42 C30 61 29 80 17 90Z',
  'M21 91 C9 57 16 23 46 15 C83 4 110 33 105 72 C103 88 92 101 76 99 C86 84 93 55 80 35 C66 43 45 44 33 34 C33 58 34 78 21 91Z',
  'M19 91 C18 48 38 10 70 15 C101 20 111 55 96 93 C82 84 78 66 84 43 C69 45 50 39 38 27 C36 55 32 79 19 91Z',
]

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function createDefaultCards(): HallCardData[] {
  const now = nowIso()
  return beautySeeds.map(([name, styleLabel], index) => ({
    id: `beauty-${index + 1}`,
    name,
    styleLabel,
    photos: [],
    secret: false,
    backSeed: index + 1,
    paletteIndex: index % backPalettes.length,
    createdAt: now,
    updatedAt: now,
  }))
}

function defaultSettings(): HallSettings {
  return {
    password: DEFAULT_PASSWORD,
    protectedTop: 0,
  }
}

function clampRank(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(MAX_CARDS, Math.round(numeric)))
}

function sanitizePhoto(value: unknown): HallPhoto | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<HallPhoto>
  if (typeof source.dataUrl !== 'string' || !source.dataUrl.startsWith('data:image/')) return null
  return {
    id: typeof source.id === 'string' ? source.id : makeId('photo'),
    dataUrl: source.dataUrl,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Photo',
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : nowIso(),
  }
}

function sanitizeCard(value: unknown, index: number): HallCardData | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<HallCardData>
  const fallback = beautySeeds[index % beautySeeds.length]
  const now = nowIso()
  return {
    id: typeof source.id === 'string' ? source.id : makeId('beauty'),
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : fallback[0],
    styleLabel: typeof source.styleLabel === 'string' && source.styleLabel.trim() ? source.styleLabel.trim() : fallback[1],
    avatarDataUrl:
      typeof source.avatarDataUrl === 'string' && source.avatarDataUrl.startsWith('data:image/')
        ? source.avatarDataUrl
        : undefined,
    photos: Array.isArray(source.photos) ? source.photos.map(sanitizePhoto).filter(Boolean).slice(0, 24) as HallPhoto[] : [],
    secret: Boolean(source.secret),
    backSeed: Number.isFinite(Number(source.backSeed)) ? Number(source.backSeed) : index + 1,
    paletteIndex: Number.isFinite(Number(source.paletteIndex)) ? Number(source.paletteIndex) : index % backPalettes.length,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
  }
}

function sanitizePayload(value: unknown): HallPayload | null {
  if (!value || typeof value !== 'object') return null
  const source = value as Partial<HallPayload>
  if (!Array.isArray(source.cards)) return null
  const cards = source.cards.map(sanitizeCard).filter(Boolean).slice(0, MAX_CARDS) as HallCardData[]
  if (!cards.length) return null
  const settingsSource = source.settings ?? defaultSettings()
  const settings: HallSettings = {
    password:
      typeof settingsSource.password === 'string' && settingsSource.password.length ? settingsSource.password : DEFAULT_PASSWORD,
    protectedTop: clampRank(settingsSource.protectedTop),
  }
  return {
    version: 1,
    exportedAt: typeof source.exportedAt === 'string' ? source.exportedAt : undefined,
    cards,
    settings,
  }
}

function loadHallState(): HallPayload {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { version: 1, cards: createDefaultCards(), settings: defaultSettings() }
    }
    const parsed = JSON.parse(raw) as unknown
    return sanitizePayload(parsed) ?? { version: 1, cards: createDefaultCards(), settings: defaultSettings() }
  } catch {
    return { version: 1, cards: createDefaultCards(), settings: defaultSettings() }
  }
}

async function readImageFile(file: File, maxSide: number) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image')))
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read image'))
    reader.readAsDataURL(file)
  })

  if (!dataUrl.startsWith('data:image/') || file.type === 'image/svg+xml') return dataUrl

  return new Promise<string>((resolve) => {
    const image = new Image()
    image.onload = () => {
      const largestSide = Math.max(image.width, image.height)
      if (!largestSide || largestSide <= maxSide) {
        resolve(dataUrl)
        return
      }
      const scale = maxSide / largestSide
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(dataUrl)
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.86))
    }
    image.onerror = () => resolve(dataUrl)
    image.src = dataUrl
  })
}

function saveBlob(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function cardBackStyle(card: HallCardData): CSSProperties {
  const palette = backPalettes[Math.abs(card.paletteIndex) % backPalettes.length]
  return {
    '--back-a': palette[0],
    '--back-b': palette[1],
    '--back-c': palette[2],
    '--back-d': palette[3],
    '--back-tilt': `${(card.backSeed % 9) - 4}deg`,
    '--back-ring': `${38 + (card.backSeed % 11)}%`,
    '--back-petal': `${5 + (card.backSeed % 5)}`,
  } as CSSProperties
}

function cardBackAssetUrl(card: HallCardData) {
  const seed = Math.max(1, Math.trunc(Math.abs(card.backSeed || 1)))
  const assetIndex = ((seed - 1) % MAX_CARDS) + 1
  return `/beauty-hall/card-backs/goddess-back-${String(assetIndex).padStart(2, '0')}.webp`
}

function GeneratedPortrait({ card }: { card: HallCardData }) {
  const palette = backPalettes[Math.abs(card.paletteIndex) % backPalettes.length]
  const hairPath = portraitHairs[Math.abs(card.backSeed) % portraitHairs.length]
  const hue = (card.backSeed * 37) % 360
  const gradientId = `portrait-${card.id}`
  return (
    <svg className="hall-generated-portrait" viewBox="0 0 120 120" role="img" aria-label={card.name}>
      <defs>
        <radialGradient id={gradientId} cx="48%" cy="28%" r="68%">
          <stop offset="0%" stopColor={palette[2]} />
          <stop offset="54%" stopColor={palette[1]} />
          <stop offset="100%" stopColor={palette[0]} />
        </radialGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill={`url(#${gradientId})`} />
      <circle cx="91" cy="25" r="10" fill="rgba(255,255,255,0.34)" />
      <path d="M19 113 C27 88 43 77 60 77 C78 77 93 88 102 113Z" fill={`hsl(${hue} 42% 18%)`} />
      <path d={hairPath} fill={`hsl(${(hue + 18) % 360} 38% 16%)`} />
      <ellipse cx="60" cy="55" rx="25" ry="31" fill={`hsl(${32 + (card.backSeed % 11)} 64% 80%)`} />
      <path d="M38 53 C44 49 49 50 53 54" stroke="#2b1b22" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M67 54 C72 50 77 50 82 53" stroke="#2b1b22" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M55 70 C60 74 66 73 70 69" stroke="#a74455" strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <path d="M52 87 C56 91 65 92 70 87" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="2" />
      <circle cx="43" cy="61" r="3" fill="rgba(242,120,144,0.28)" />
      <circle cx="78" cy="61" r="3" fill="rgba(242,120,144,0.28)" />
      <path d="M31 113 C38 96 47 89 60 89 C74 89 85 96 91 113Z" fill={palette[1]} opacity="0.86" />
    </svg>
  )
}

function CardBack({ card, mini = false }: { card: HallCardData; mini?: boolean }) {
  const motif = Math.abs(card.backSeed) % 8
  return (
    <div className={`hall-card-back hall-card-back--motif-${motif} ${mini ? 'hall-card-back--mini' : ''}`} style={cardBackStyle(card)}>
      <img className="hall-card-back__art" src={cardBackAssetUrl(card)} alt="" loading="lazy" />
      <span className="hall-card-back__corner hall-card-back__corner--tl" />
      <span className="hall-card-back__corner hall-card-back__corner--tr" />
      <span className="hall-card-back__corner hall-card-back__corner--bl" />
      <span className="hall-card-back__corner hall-card-back__corner--br" />
      <span className="hall-card-back__halo" />
      <span className="hall-card-back__sigil">
        <Sparkles size={mini ? 18 : 28} />
      </span>
      <span className="hall-card-back__name">No. {String(card.backSeed).padStart(2, '0')}</span>
    </div>
  )
}

function isProtected(card: HallCardData, rankIndex: number, settings: HallSettings) {
  return card.secret || (settings.protectedTop > 0 && rankIndex < settings.protectedTop)
}

export function BeautyHallPage() {
  const loaded = useMemo(loadHallState, [])
  const [cards, setCards] = useState<HallCardData[]>(loaded.cards)
  const [settings, setSettings] = useState<HallSettings>(loaded.settings)
  const [flipped, setFlipped] = useState<Record<string, boolean>>({})
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set())
  const [unlockTargetId, setUnlockTargetId] = useState<string | null>(null)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [drawIndex, setDrawIndex] = useState(0)
  const [drawToken, setDrawToken] = useState(0)
  const [swapAId, setSwapAId] = useState(() => loaded.cards[0]?.id ?? '')
  const [swapBId, setSwapBId] = useState(() => loaded.cards[1]?.id ?? loaded.cards[0]?.id ?? '')
  const [notice, setNotice] = useState<string | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)

  const activeCard = activeCardId ? cards.find((card) => card.id === activeCardId) ?? null : null
  const activePhoto = activeCard?.photos.length ? activeCard.photos[drawIndex % activeCard.photos.length] : null
  const secretCount = cards.filter((card) => card.secret).length
  const rankOptions = useMemo(
    () => cards.map((card, index) => ({ card, label: `${index + 1}. ${card.name}` })),
    [cards],
  )

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cards, settings }))
      setStorageError(null)
    } catch {
      setStorageError('本地存储空间不足，建议先导出备份或压缩图片。')
    }
  }, [cards, settings])

  useEffect(() => {
    setSwapAId((current) => (cards.some((card) => card.id === current) ? current : cards[0]?.id ?? ''))
    setSwapBId((current) => (cards.some((card) => card.id === current) ? current : cards[1]?.id ?? cards[0]?.id ?? ''))
  }, [cards])

  function patchCard(cardId: string, patch: Partial<HallCardData>) {
    setCards((current) =>
      current.map((card) => (card.id === cardId ? { ...card, ...patch, updatedAt: nowIso() } : card)),
    )
  }

  function moveCard(cardId: string, direction: -1 | 1) {
    setCards((current) => {
      const index = current.findIndex((card) => card.id === cardId)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [picked] = next.splice(index, 1)
      next.splice(nextIndex, 0, picked)
      return next
    })
  }

  function swapRanks() {
    const from = cards.findIndex((card) => card.id === swapAId)
    const to = cards.findIndex((card) => card.id === swapBId)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= cards.length || to >= cards.length) {
      setNotice('请选择有效排名。')
      return
    }
    if (from === to) return
    const fromName = cards[from].name
    const toName = cards[to].name
    setCards((current) => {
      const next = [...current]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
    setNotice(`已交换第 ${from + 1} 名 ${fromName} 和第 ${to + 1} 名 ${toName}。`)
  }

  function requestFlip(card: HallCardData, index: number) {
    if (isProtected(card, index, settings) && !unlockedIds.has(card.id)) {
      setUnlockTargetId(card.id)
      setUnlockPassword('')
      setUnlockError(null)
      return
    }
    setFlipped((current) => ({ ...current, [card.id]: !current[card.id] }))
  }

  function unlockCard() {
    if (!unlockTargetId) return
    if (unlockPassword !== settings.password) {
      setUnlockError('密码不正确。')
      return
    }
    setUnlockedIds((current) => new Set(current).add(unlockTargetId))
    setFlipped((current) => ({ ...current, [unlockTargetId]: true }))
    setUnlockTargetId(null)
    setUnlockPassword('')
    setUnlockError(null)
  }

  async function handleAvatarUpload(cardId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const dataUrl = await readImageFile(file, 720)
    patchCard(cardId, { avatarDataUrl: dataUrl })
  }

  async function handlePhotoUpload(cardId: string, event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    const photos = await Promise.all(
      files.map(async (file) => ({
        id: makeId('photo'),
        dataUrl: await readImageFile(file, 1400),
        name: file.name,
        createdAt: nowIso(),
      })),
    )
    setCards((current) =>
      current.map((card) =>
        card.id === cardId ? { ...card, photos: [...photos, ...card.photos].slice(0, 24), updatedAt: nowIso() } : card,
      ),
    )
    setDrawIndex(0)
    setDrawToken((value) => value + 1)
  }

  function drawNextPhoto() {
    if (!activeCard?.photos.length) return
    setDrawIndex((value) => (value + 1) % activeCard.photos.length)
    setDrawToken((value) => value + 1)
  }

  function deleteActivePhoto(photoId: string) {
    if (!activeCard) return
    setCards((current) =>
      current.map((card) =>
        card.id === activeCard.id
          ? { ...card, photos: card.photos.filter((photo) => photo.id !== photoId), updatedAt: nowIso() }
          : card,
      ),
    )
    setDrawIndex(0)
  }

  function exportData() {
    saveBlob(
      `beauty-hall-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 1, exportedAt: nowIso(), cards, settings }, null, 2),
    )
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') throw new Error('Invalid file')
        const parsed = sanitizePayload(JSON.parse(reader.result) as unknown)
        if (!parsed) throw new Error('Invalid payload')
        setCards(parsed.cards)
        setSettings(parsed.settings)
        setSwapAId(parsed.cards[0]?.id ?? '')
        setSwapBId(parsed.cards[1]?.id ?? parsed.cards[0]?.id ?? '')
        setFlipped({})
        setUnlockedIds(new Set())
        setActiveCardId(null)
        setNotice(`已导入 ${parsed.cards.length} 张卡牌。`)
      } catch {
        setNotice('导入失败，请检查 JSON 文件。')
      }
    }
    reader.readAsText(file)
  }

  function addCard() {
    if (cards.length >= MAX_CARDS) return
    const index = cards.length
    const seed = beautySeeds[index % beautySeeds.length]
    const now = nowIso()
    setCards((current) => [
      ...current,
      {
        id: makeId('beauty'),
        name: seed[0],
        styleLabel: seed[1],
        photos: [],
        secret: false,
        backSeed: index + 1,
        paletteIndex: index % backPalettes.length,
        createdAt: now,
        updatedAt: now,
      },
    ])
  }

  function resetDefaults() {
    const defaultCards = createDefaultCards()
    setCards(defaultCards)
    setSettings(defaultSettings())
    setSwapAId(defaultCards[0]?.id ?? '')
    setSwapBId(defaultCards[1]?.id ?? defaultCards[0]?.id ?? '')
    setFlipped({})
    setUnlockedIds(new Set())
    setActiveCardId(null)
    setNotice('已恢复默认 50 张卡牌。')
  }

  return (
    <main className="hall-page">
      <section className="hall-shell" aria-label="Beauty Hall">
        <header className="hall-topbar">
          <Link className="hall-icon-button" to="/" title="返回首页">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <span className="hall-kicker">Beauty Hall</span>
            <h1>Beauty Hall</h1>
          </div>
          <div className="hall-topbar__actions">
            <button className="hall-icon-button" type="button" onClick={exportData} title="导出数据">
              <Download size={18} />
            </button>
            <label className="hall-icon-button hall-file-button" title="导入数据">
              <Upload size={18} />
              <input accept="application/json" type="file" onChange={importData} />
            </label>
          </div>
        </header>

        <section className="hall-dashboard">
          <div className="hall-panel hall-panel--hero">
            <div className="hall-hero-copy">
              <span className="hall-kicker">Local Gallery</span>
              <h2>Ranked Tarot Cards</h2>
            </div>
            <div className="hall-stat-grid">
              <div>
                <span>卡牌</span>
                <strong>{cards.length}/50</strong>
              </div>
              <div>
                <span>绝密</span>
                <strong>{secretCount}</strong>
              </div>
              <div>
                <span>保护排名</span>
                <strong>Top {settings.protectedTop}</strong>
              </div>
            </div>
          </div>

          <div className="hall-panel hall-controls">
            <label>
              <span>保护排名</span>
              <input
                max={MAX_CARDS}
                min={0}
                type="number"
                value={settings.protectedTop}
                onChange={(event) => setSettings((current) => ({ ...current, protectedTop: clampRank(event.target.value) }))}
              />
            </label>
            <label>
              <span>本地密码</span>
              <input
                type="password"
                value={settings.password}
                onChange={(event) => setSettings((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            <button className="hall-secondary-button" type="button" onClick={() => setUnlockedIds(new Set())}>
              <Shield size={17} />
              锁定会话
            </button>
          </div>

          <div className="hall-panel hall-swapper">
            <div className="hall-swapper__selects">
              <label>
                <span>排名 A</span>
                <select value={swapAId} onChange={(event) => setSwapAId(event.target.value)}>
                  {rankOptions.map(({ card, label }, index) => (
                    <option key={`${index + 1}-${card.id}`} value={card.id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>排名 B</span>
                <select value={swapBId} onChange={(event) => setSwapBId(event.target.value)}>
                  {rankOptions.map(({ card, label }, index) => (
                    <option key={`${index + 1}-${card.id}`} value={card.id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="hall-button-row">
              <button className="hall-primary-button" type="button" onClick={swapRanks}>
                <Shuffle size={17} />
                交换排名
              </button>
              <button className="hall-secondary-button" type="button" onClick={addCard} disabled={cards.length >= MAX_CARDS}>
                <Plus size={17} />
                新增
              </button>
              <button className="hall-secondary-button" type="button" onClick={resetDefaults}>
                <RefreshCcw size={17} />
                重置
              </button>
            </div>
          </div>
        </section>

        {(notice || storageError) && <div className="hall-notice">{storageError ?? notice}</div>}

        <section className="hall-grid" aria-label="名人堂卡牌">
          {cards.map((card, index) => {
            const protectedCard = isProtected(card, index, settings)
            const unlocked = unlockedIds.has(card.id)
            const frontVisible = Boolean(flipped[card.id])
            return (
              <article className="hall-entry" key={card.id}>
                <div className="hall-entry__rank">
                  <strong>#{index + 1}</strong>
                  <span>{card.styleLabel}</span>
                </div>
                <div className={`hall-flip-card ${frontVisible ? 'is-flipped' : ''}`}>
                  <div className="hall-flip-card__inner">
                    <div className="hall-face hall-face--front">
                      <div className="hall-avatar-frame">
                        <label className="hall-avatar-upload" title="上传头像">
                          {card.avatarDataUrl ? <img src={card.avatarDataUrl} alt={card.name} /> : <GeneratedPortrait card={card} />}
                          <input accept="image/*" type="file" onChange={(event) => void handleAvatarUpload(card.id, event)} />
                          <span>
                            <ImagePlus size={16} />
                          </span>
                        </label>
                      </div>
                      <input
                        className="hall-name-input"
                        value={card.name}
                        onChange={(event) => patchCard(card.id, { name: event.target.value })}
                        aria-label="名字"
                      />
                      <div className="hall-card-meta">
                        <span>{card.photos.length} photos</span>
                        {protectedCard && (
                          <span className="hall-card-meta__lock">
                            <LockKeyhole size={14} />
                            {unlocked ? '已解锁' : '加密'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="hall-face hall-face--back"
                      type="button"
                      onClick={() => requestFlip(card, index)}
                      aria-label={`翻开 ${card.name}`}
                    >
                      <CardBack card={card} />
                    </button>
                  </div>
                </div>
                <div className="hall-entry__actions">
                  <button className="hall-mini-button" type="button" onClick={() => moveCard(card.id, -1)} disabled={index === 0} title="上移">
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="hall-mini-button"
                    type="button"
                    onClick={() => moveCard(card.id, 1)}
                    disabled={index === cards.length - 1}
                    title="下移"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="hall-mini-button"
                    type="button"
                    onClick={() => patchCard(card.id, { secret: !card.secret })}
                    title={card.secret ? '取消绝密' : '设为绝密'}
                  >
                    {card.secret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button className="hall-mini-button" type="button" onClick={() => requestFlip(card, index)} title="翻转">
                    <RefreshCcw size={16} />
                  </button>
                  <button
                    className="hall-expand-button"
                    type="button"
                    onClick={() => {
                      if (protectedCard && !unlocked) {
                        setUnlockTargetId(card.id)
                        return
                      }
                      setActiveCardId(card.id)
                      setDrawIndex(0)
                      setDrawToken((value) => value + 1)
                    }}
                  >
                    展开
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      </section>

      {unlockTargetId && (
        <div className="hall-modal-backdrop" role="dialog" aria-modal="true" aria-label="密码验证">
          <div className="hall-lock-modal">
            <div className="hall-modal-head">
              <div>
                <span className="hall-kicker">Private Card</span>
                <h2>密码验证</h2>
              </div>
              <button className="hall-icon-button" type="button" onClick={() => setUnlockTargetId(null)} title="关闭">
                <X size={18} />
              </button>
            </div>
            <div className="hall-lock-form">
              <label>
                <span>本地密码</span>
                <input
                  autoFocus
                  type="password"
                  value={unlockPassword}
                  onChange={(event) => setUnlockPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') unlockCard()
                  }}
                />
              </label>
              {unlockError && <p className="hall-error">{unlockError}</p>}
              <button className="hall-primary-button" type="button" onClick={unlockCard}>
                <Save size={17} />
                解锁
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCard && (
        <div className="hall-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${activeCard.name} 详情`}>
          <div className="hall-detail-modal">
            <div className="hall-modal-head">
              <div>
                <span className="hall-kicker">Card Deck</span>
                <h2>{activeCard.name}</h2>
              </div>
              <button className="hall-icon-button" type="button" onClick={() => setActiveCardId(null)} title="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="hall-detail-layout">
              <div className="hall-draw-zone">
                <div className="hall-deck-stack" aria-hidden="true">
                  <CardBack card={activeCard} mini />
                  <CardBack card={activeCard} mini />
                  <CardBack card={activeCard} mini />
                </div>
                <div className="hall-draw-card" key={`${activeCard.id}-${activePhoto?.id ?? 'empty'}-${drawToken}`}>
                  <div className="hall-draw-card__inner">
                    <div className="hall-draw-card__back">
                      <CardBack card={activeCard} />
                    </div>
                    <div className="hall-draw-card__front">
                      {activePhoto ? <img src={activePhoto.dataUrl} alt={activePhoto.name} /> : <GeneratedPortrait card={activeCard} />}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hall-detail-side">
                <div className="hall-button-row">
                  <button className="hall-primary-button" type="button" onClick={drawNextPhoto} disabled={!activeCard.photos.length}>
                    <Sparkles size={17} />
                    抽一张
                  </button>
                  <label className="hall-secondary-button hall-file-button">
                    <FileJson size={17} />
                    上传照片
                    <input accept="image/*" multiple type="file" onChange={(event) => void handlePhotoUpload(activeCard.id, event)} />
                  </label>
                </div>

                <div className="hall-photo-strip">
                  {activeCard.photos.length ? (
                    activeCard.photos.map((photo, index) => (
                      <button
                        className={`hall-photo-thumb ${index === drawIndex % activeCard.photos.length ? 'is-active' : ''}`}
                        key={photo.id}
                        type="button"
                        onClick={() => {
                          setDrawIndex(index)
                          setDrawToken((value) => value + 1)
                        }}
                        title={photo.name}
                      >
                        <img src={photo.dataUrl} alt={photo.name} />
                      </button>
                    ))
                  ) : (
                    <div className="hall-empty">暂无照片</div>
                  )}
                </div>

                {activePhoto && (
                  <button className="hall-secondary-button" type="button" onClick={() => deleteActivePhoto(activePhoto.id)}>
                    <Trash2 size={17} />
                    删除当前照片
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
