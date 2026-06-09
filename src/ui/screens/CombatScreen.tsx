import { useEffect, useState } from 'react';
import { useGameStore } from '../../game/store/useGameStore';
import { CombatLog } from '../components/CombatLog';
import { EnemyPanel } from '../components/EnemyPanel';
import { EndTurnButton } from '../components/EndTurnButton';
import { Hand } from '../components/Hand';
import { PileInfo } from '../components/PileInfo';
import { PlayerPanel } from '../components/PlayerPanel';
import { getTerminology } from '../terminology/terminology';

export function CombatScreen() {
  const combat = useGameStore((state) => state.combat);
  const run = useGameStore((state) => state.run);
  const settings = useGameStore((state) => state.settings);
  const playCard = useGameStore((state) => state.playCard);
  const endTurn = useGameStore((state) => state.endTurn);
  const returnToMenu = useGameStore((state) => state.returnToMenu);
  const openSettings = useGameStore((state) => state.openSettings);
  const terminology = getTerminology(settings.mode);
  const [selectedEnemyId, setSelectedEnemyId] = useState<string>();

  useEffect(() => {
    const aliveEnemy = combat?.enemies.find(isEnemySelectable);
    if (!aliveEnemy) {
      setSelectedEnemyId(undefined);
      return;
    }

    const selectedEnemy = combat?.enemies.find(
      (enemy) => enemy.instanceId === selectedEnemyId && isEnemySelectable(enemy),
    );
    if (!selectedEnemy) {
      setSelectedEnemyId(aliveEnemy.instanceId);
    }
  }, [combat, selectedEnemyId]);

  if (!combat || !run) {
    return (
      <main className="app-shell main-menu">
        <section className="menu-panel">
          <h1>没有进行中的战斗</h1>
          <button className="primary-button" onClick={returnToMenu}>
            返回主菜单
          </button>
        </section>
      </main>
    );
  }

  const targetEnemy =
    combat.enemies.find((enemy) => enemy.instanceId === selectedEnemyId && isEnemySelectable(enemy)) ??
    combat.enemies.find(isEnemySelectable);
  const currentNode = run.map.find((node) => node.id === run.currentNodeId);
  const routeTitle =
    settings.mode === 'stealth'
      ? currentNode?.lowProfileLabel ?? '常规会话'
      : currentNode?.label ?? '普通战斗';

  return (
    <main className="app-shell combat-layout">
      <header className="combat-topbar">
        <div>
          <p className="eyebrow">
            {settings.mode === 'stealth' ? '第' : '第'}
            {run.floor} {settings.mode === 'stealth' ? '项' : '层'}
          </p>
          <h1>{routeTitle}</h1>
        </div>
        <div className="button-row">
          <EndTurnButton
            mode={settings.mode}
            disabled={combat.phase !== 'player'}
            onClick={endTurn}
          />
          <button className="secondary-button" onClick={openSettings}>
            设置
          </button>
          <button className="secondary-button" onClick={returnToMenu}>
            {settings.mode === 'stealth' ? '返回面板' : '返回主菜单'}
          </button>
        </div>
      </header>

      <section className="combat-board">
        <PlayerPanel
          player={combat.player}
          energy={combat.energy}
          maxEnergy={combat.maxEnergy}
          mode={settings.mode}
        />
        <div className="enemy-zone">
          <h2>{terminology.enemy}</h2>
          <div className="enemy-list">
            {combat.enemies.map((enemy) => (
              <EnemyPanel
                key={enemy.instanceId}
                enemy={enemy}
                mode={settings.mode}
                selected={enemy.instanceId === targetEnemy?.instanceId}
                onSelect={() => setSelectedEnemyId(enemy.instanceId)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="combat-footer">
        <PileInfo combat={combat} mode={settings.mode} />
        <Hand
          cards={combat.hand}
          energy={combat.energy}
          mode={settings.mode}
          targetEnemyId={targetEnemy?.instanceId}
          onPlay={playCard}
        />
        <CombatLog entries={combat.log} mode={settings.mode} />
      </section>
    </main>
  );
}

function isEnemySelectable(enemy: { hp: number; defeated?: boolean }): boolean {
  return enemy.hp > 0 && !enemy.defeated;
}
