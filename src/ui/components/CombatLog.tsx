import type { GameMode } from '../../game/types';
import { getTerminology } from '../terminology/terminology';

interface CombatLogProps {
  entries: string[];
  mode?: GameMode;
}

export function CombatLog({ entries, mode = 'normal' }: CombatLogProps) {
  const terminology = getTerminology(mode);

  return (
    <section className="log-panel" aria-label={terminology.log}>
      <h2 className="log-title">{terminology.log}</h2>
      <ol>
        {entries.slice(-12).map((entry, index) => (
          <li key={`${entry}-${index}`}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
