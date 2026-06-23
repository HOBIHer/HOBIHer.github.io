import type { RelicId } from '../types';

export const ironOathStarterDeck = [
  'short-blade-advance',
  'short-blade-advance',
  'short-blade-advance',
  'short-blade-advance',
  'short-blade-advance',
  'guarded-stance',
  'guarded-stance',
  'guarded-stance',
  'guarded-stance',
  'break-stance-smash',
];

export const ironOathStarterRelics: RelicId[] = ['afterglow-charm'];

export const ironOathStarterLoadout = {
  characterClassId: 'iron-oath',
  deck: ironOathStarterDeck,
  relics: ironOathStarterRelics,
} as const;
