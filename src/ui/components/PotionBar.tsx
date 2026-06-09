import { potionById } from '../../game/data/potions/potions';
import type { GameMode, PotionInstance } from '../../game/types';
import { getTerminology } from '../terminology/terminology';

interface PotionBarProps {
  potions: PotionInstance[];
  potionSlots: number;
  mode?: GameMode;
  targetEnemyId?: string;
  disabled?: boolean;
  onUse: (potionInstanceId: string, targetEnemyId?: string) => void;
}

export function PotionBar({
  potions,
  potionSlots,
  mode = 'normal',
  targetEnemyId,
  disabled = false,
  onUse,
}: PotionBarProps) {
  const terminology = getTerminology(mode);
  const emptySlots = Math.max(0, potionSlots - potions.length);

  return (
    <section className="potion-bar" aria-label={mode === 'stealth' ? '补剂栏' : '药水栏'}>
      {potions.map((potion) => {
        const definition = potionById[potion.definitionId];
        const name = mode === 'stealth' ? definition?.lowProfileName : definition?.name;
        const description = mode === 'stealth' ? definition?.lowProfileDescription : definition?.description;
        const needsTarget = definition?.target === 'enemy';
        return (
          <button
            className="potion-button"
            disabled={disabled || (needsTarget && !targetEnemyId)}
            key={potion.instanceId}
            onClick={() => onUse(potion.instanceId, needsTarget ? targetEnemyId : undefined)}
            title={description}
          >
            <strong>{name ?? potion.definitionId}</strong>
            <span>{description}</span>
          </button>
        );
      })}
      {Array.from({ length: emptySlots }).map((_, index) => (
        <span className="potion-empty-slot" key={`empty-${index}`}>
          {terminology.card === '操作项' ? '空位' : '空槽'}
        </span>
      ))}
    </section>
  );
}
