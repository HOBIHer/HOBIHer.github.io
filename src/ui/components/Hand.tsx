import { warriorCardById } from '../../game/data/cards/warrior';
import type { CardInstance, GameMode } from '../../game/types';
import { getTerminology } from '../terminology/terminology';
import { CardView } from './CardView';

interface HandProps {
  cards: CardInstance[];
  energy: number;
  mode?: GameMode;
  targetEnemyId?: string;
  onPlay: (cardInstanceId: string, targetEnemyId?: string) => void;
}

export function Hand({ cards, energy, mode = 'normal', targetEnemyId, onPlay }: HandProps) {
  const terminology = getTerminology(mode);

  if (cards.length === 0) {
    return <p className="menu-copy">{terminology.card}为空。</p>;
  }

  return (
    <div className="hand" aria-label={terminology.card}>
      {cards.map((cardInstance) => {
        const card = warriorCardById[cardInstance.definitionId];
        return (
          <CardView
            key={cardInstance.instanceId}
            card={card}
            mode={mode}
            disabled={card.cost > energy}
            onClick={() => onPlay(cardInstance.instanceId, targetEnemyId)}
          />
        );
      })}
    </div>
  );
}
