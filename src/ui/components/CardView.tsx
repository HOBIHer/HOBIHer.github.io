import type { CardDefinition, GameMode } from '../../game/types';
import { getTerminology } from '../terminology/terminology';

interface CardViewProps {
  card: CardDefinition;
  mode?: GameMode;
  disabled?: boolean;
  onClick?: () => void;
}

const typeLabels: Record<CardDefinition['type'], string> = {
  attack: '攻击',
  skill: '技能',
  power: '能力',
};

export function CardView({ card, mode = 'normal', disabled = false, onClick }: CardViewProps) {
  const terminology = getTerminology(mode);
  const displayName = mode === 'stealth' ? card.lowProfileName : card.name;
  const description = mode === 'stealth' ? card.lowProfileDescription : card.description;
  const typeLabel = mode === 'stealth' ? terminology.card : typeLabels[card.type];

  return (
    <button className={`card-button ${card.type}`} disabled={disabled} onClick={onClick}>
      <span className="card-header">
        <span className="card-name">{displayName}</span>
        <span className="card-cost">{card.cost === 'X' ? 'X' : card.cost}</span>
      </span>
      <span className="card-type">{typeLabel}</span>
      <p className="card-description">{description}</p>
    </button>
  );
}
