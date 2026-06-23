import type { GameMode } from '../../game/types';
import { getTerminology } from '../terminology/terminology';

interface EndTurnButtonProps {
  mode?: GameMode;
  disabled?: boolean;
  onClick?: () => void;
}

export function EndTurnButton({ mode = 'normal', disabled = false, onClick }: EndTurnButtonProps) {
  const terminology = getTerminology(mode);

  return (
    <button className="end-turn-button" disabled={disabled} onClick={onClick}>
      {terminology.endTurn}
    </button>
  );
}
