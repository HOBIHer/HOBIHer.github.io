import { useGameStore } from '../../game/store/useGameStore';
import type { RunState, UserSettings } from '../../game/types';
import { getTerminology } from '../terminology/terminology';

export function RestScreen() {
  const run = useGameStore((state) => state.run);
  const settings = useGameStore((state) => state.settings);
  const restAtCurrentNode = useGameStore((state) => state.restAtCurrentNode);
  const returnToMapAfterRest = useGameStore((state) => state.returnToMapAfterRest);
  const openSettings = useGameStore((state) => state.openSettings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);

  return (
    <RestScreenView
      openSettings={openSettings}
      restAtCurrentNode={restAtCurrentNode}
      returnToMapAfterRest={returnToMapAfterRest}
      returnToMenu={returnToMenu}
      run={run}
      settings={settings}
    />
  );
}

interface RestScreenViewProps {
  run?: RunState;
  settings: UserSettings;
  restAtCurrentNode: () => void;
  returnToMapAfterRest?: () => void;
  openSettings: () => void;
  returnToMenu: () => void;
}

export function RestScreenView({
  run,
  settings,
  restAtCurrentNode,
  returnToMapAfterRest = () => undefined,
  openSettings,
  returnToMenu,
}: RestScreenViewProps) {
  const terminology = getTerminology(settings.mode);

  if (!run) {
    return (
      <main className="app-shell main-menu">
        <section className="menu-panel">
          <h1>没有可整理的节点</h1>
          <button className="primary-button" onClick={returnToMenu}>
            返回主菜单
          </button>
        </section>
      </main>
    );
  }

  const title = settings.mode === 'stealth' ? '整理节点' : '休整点';
  const restoreText =
    settings.mode === 'stealth' ? '恢复 30% 稳定度上限' : '恢复 30% 最大生命';
  const result = run.lastRestResult;
  const hpLabel = terminology.hp;
  const resultText = result
    ? `${hpLabel} ${result.beforeHp} -> ${result.afterHp}，恢复 ${result.healed}`
    : undefined;

  return (
    <main className="app-shell rest-shell">
      <section className="rest-panel">
        <div className="screen-header">
          <div>
            <p className="eyebrow">{settings.mode === 'stealth' ? '流程维护' : '路线休整'}</p>
            <h1>{title}</h1>
          </div>
          <button className="secondary-button" onClick={openSettings}>
            设置
          </button>
        </div>

        <div className="rest-summary">
          <strong>
            {terminology.hp} {run.character.hp}/{run.character.maxHp}
          </strong>
          <span>{restoreText}</span>
        </div>

        {resultText ? (
          <div className="rest-result" role="status">
            {resultText}
          </div>
        ) : null}

        <div className="rest-actions">
          <button className="primary-button" disabled={Boolean(result)} onClick={restAtCurrentNode}>
            {settings.mode === 'stealth' ? '整理' : '休息'}
          </button>
          {result ? (
            <button className="primary-button" onClick={returnToMapAfterRest}>
              {settings.mode === 'stealth' ? '返回流程面板' : '返回路线'}
            </button>
          ) : null}
          <button className="secondary-button" disabled>
            {settings.mode === 'stealth' ? '优化操作项：后续开放' : '升级卡牌：后续开放'}
          </button>
        </div>
      </section>
    </main>
  );
}
