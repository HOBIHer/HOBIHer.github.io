import { useEffect } from 'react';
import { CombatScreen } from './ui/screens/CombatScreen';
import { DefeatScreen } from './ui/screens/DefeatScreen';
import { MainMenu } from './ui/screens/MainMenu';
import { MapScreen } from './ui/screens/MapScreen';
import { RestScreen } from './ui/screens/RestScreen';
import { RewardScreen } from './ui/screens/RewardScreen';
import { RunHistoryScreen } from './ui/screens/RunHistoryScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { VictoryScreen } from './ui/screens/VictoryScreen';
import { useGameStore } from './game/store/useGameStore';
import { getAppRootClassName, getAppRootStyle } from './ui/themes/appTheme';

export default function App() {
  const screen = useGameStore((state) => state.screen);
  const settings = useGameStore((state) => state.settings);
  const toggleGameMode = useGameStore((state) => state.toggleGameMode);
  const openSettings = useGameStore((state) => state.openSettings);
  const closeSettings = useGameStore((state) => state.closeSettings);
  const endTurn = useGameStore((state) => state.endTurn);
  const playCard = useGameStore((state) => state.playCard);
  const combat = useGameStore((state) => state.combat);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFormTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.key === 'Escape') {
        if (useGameStore.getState().screen === 'settings') {
          closeSettings();
        } else {
          openSettings();
        }
        return;
      }

      if (key === 's') {
        toggleGameMode();
        return;
      }

      if (key === 'e' && useGameStore.getState().screen === 'combat') {
        endTurn();
        return;
      }

      const handIndex = Number(event.key) - 1;
      if (
        handIndex >= 0 &&
        handIndex <= 8 &&
        useGameStore.getState().screen === 'combat' &&
        combat
      ) {
        const card = combat.hand[handIndex];
        const targetEnemy = combat.enemies.find((enemy) => enemy.hp > 0 && !enemy.defeated);
        if (card) {
          playCard(card.instanceId, targetEnemy?.instanceId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeSettings, combat, endTurn, openSettings, playCard, toggleGameMode]);

  const content = renderScreen(screen);

  return (
    <div className={getAppRootClassName(settings)} style={getAppRootStyle(settings)}>
      {content}
    </div>
  );
}

function renderScreen(screen: string) {
  if (screen === 'map') {
    return <MapScreen />;
  }

  if (screen === 'combat') {
    return <CombatScreen />;
  }

  if (screen === 'reward') {
    return <RewardScreen />;
  }

  if (screen === 'rest') {
    return <RestScreen />;
  }

  if (screen === 'victory') {
    return <VictoryScreen />;
  }

  if (screen === 'defeat') {
    return <DefeatScreen />;
  }

  if (screen === 'settings') {
    return <SettingsScreen />;
  }

  if (screen === 'runHistory') {
    return <RunHistoryScreen />;
  }

  return <MainMenu />;
}

function isFormTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(target.tagName);
}
