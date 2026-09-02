export type TarotArcana = 'major' | 'minor'

export type TarotSuit = 'wands' | 'cups' | 'swords' | 'pentacles'

export type TarotRank =
  | 'major'
  | 'ace'
  | 'two'
  | 'three'
  | 'four'
  | 'five'
  | 'six'
  | 'seven'
  | 'eight'
  | 'nine'
  | 'ten'
  | 'page'
  | 'knight'
  | 'queen'
  | 'king'

export interface TarotCardMeta {
  id: string
  deckIndex: number
  arcana: TarotArcana
  suit: TarotSuit | null
  number: number
  rank: TarotRank
  nameZh: string
  nameEn: string
  uprightKeywordsZh: readonly string[]
}

export interface TarotSpreadSlot {
  id: string
  order: number
  labelZh: string
  labelEn: string
  meaningZh: string
  x: number
  y: number
  rotationDeg: number
  layer?: number
}

export interface TarotSpread {
  id: string
  nameZh: string
  nameEn: string
  cardCount: number
  slots: readonly TarotSpreadSlot[]
}

export interface Point2D {
  x: number
  y: number
}

export interface Size2D {
  width: number
  height: number
}
