import { useState } from 'react';
import { getBaseCardDefinition, getEffectiveCardDefinition } from '../../game/engine/cardUpgrades';
import { useGameStore } from '../../game/store/useGameStore';
import type { CardCost, RestResult, RunState, UserSettings } from '../../game/types';
import { getTerminology } from '../terminology/terminology';

export function RestScreen() {
  const run = useGameStore((state) => state.run);
  const settings = useGameStore((state) => state.settings);
  const restAtCurrentNode = useGameStore((state) => state.restAtCurrentNode);
  const upgradeCardAtCurrentNode = useGameStore((state) => state.upgradeCardAtCurrentNode);
  const returnToMapAfterRest = useGameStore((state) => state.returnToMapAfterRest);
  const openSettings = useGameStore((state) => state.openSettings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);

  return (
    <RestScreenView
      openSettings={openSettings}
      restAtCurrentNode={restAtCurrentNode}
      upgradeCardAtCurrentNode={upgradeCardAtCurrentNode}
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
  upgradeCardAtCurrentNode?: (cardInstanceId: string) => void;
  returnToMapAfterRest?: () => void;
  openSettings: () => void;
  returnToMenu: () => void;
}

export function RestScreenView({
  run,
  settings,
  restAtCurrentNode,
  upgradeCardAtCurrentNode = () => undefined,
  returnToMapAfterRest = () => undefined,
  openSettings,
  returnToMenu,
}: RestScreenViewProps) {
  const terminology = getTerminology(settings.mode);
  const [showUpgradeList, setShowUpgradeList] = useState(false);

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
  const hasResult = Boolean(result);
  const upgradeTitle = settings.mode === 'stealth' ? '优化操作项' : '升级卡牌';
  const resultContent = result ? renderRestResult(result, settings.mode, hpLabel) : undefined;

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

        {resultContent ? (
          <div className="rest-result" role="status">
            {resultContent}
          </div>
        ) : null}

        <div className="rest-actions">
          <button className="primary-button" disabled={hasResult} onClick={restAtCurrentNode}>
            {settings.mode === 'stealth' ? '整理' : '休息'}
          </button>
          <button
            className="secondary-button"
            disabled={hasResult}
            onClick={() => setShowUpgradeList((value) => !value)}
          >
            {upgradeTitle}
          </button>
          {result ? (
            <button className="primary-button" onClick={returnToMapAfterRest}>
              {settings.mode === 'stealth' ? '返回流程面板' : '返回路线'}
            </button>
          ) : null}
        </div>

        {showUpgradeList && !hasResult ? (
          <section className="upgrade-list" aria-label={upgradeTitle}>
            <h2 className="section-title">{upgradeTitle}</h2>
            <div className="upgrade-card-grid">
              {run.deck.map((card) => {
                const baseCard = getBaseCardDefinition(card.definitionId);
                const displayCard = getEffectiveCardDefinition(card);
                const displayName = settings.mode === 'stealth' ? baseCard.lowProfileName : baseCard.name;
                const description =
                  settings.mode === 'stealth'
                    ? displayCard.lowProfileDescription
                    : displayCard.description;

                return (
                  <button
                    className="secondary-button upgrade-card-button"
                    disabled={card.upgraded}
                    key={card.instanceId}
                    onClick={() => upgradeCardAtCurrentNode(card.instanceId)}
                    title={description}
                  >
                    <span>{displayName}</span>
                    <span className="relic-description">
                      {card.upgraded
                        ? settings.mode === 'stealth'
                          ? '已优化'
                          : '已升级'
                        : settings.mode === 'stealth'
                          ? '可优化'
                          : '可升级'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function renderRestResult(result: RestResult, mode: UserSettings['mode'], hpLabel: string) {
  if (result.action !== 'upgrade') {
    return `${hpLabel} ${result.beforeHp} -> ${result.afterHp}，恢复 ${result.healed}`;
  }

  const name = mode === 'stealth' ? result.upgradedLowProfileName : result.upgradedCardName;
  const beforeDescription =
    mode === 'stealth'
      ? result.upgradeBeforeLowProfileDescription
      : result.upgradeBeforeDescription;
  const afterDescription =
    mode === 'stealth'
      ? result.upgradeAfterLowProfileDescription
      : result.upgradeAfterDescription;
  const costChanged =
    result.upgradeBeforeCost !== undefined &&
    result.upgradeAfterCost !== undefined &&
    result.upgradeBeforeCost !== result.upgradeAfterCost;

  return (
    <div className="rest-result-details">
      <strong>
        {mode === 'stealth' ? `「${name ?? '操作项'}」已优化` : `「${name ?? '卡牌'}」已升级`}
      </strong>
      {beforeDescription ? (
        <span>{mode === 'stealth' ? `优化前：${beforeDescription}` : `升级前：${beforeDescription}`}</span>
      ) : null}
      {afterDescription ? (
        <span>{mode === 'stealth' ? `优化后：${afterDescription}` : `升级后：${afterDescription}`}</span>
      ) : null}
      {costChanged ? (
        <span>
          {mode === 'stealth' ? '成本' : '费用'} {formatCost(result.upgradeBeforeCost)} -&gt;{' '}
          {formatCost(result.upgradeAfterCost)}
        </span>
      ) : null}
    </div>
  );
}

function formatCost(cost: CardCost | undefined): string {
  if (cost === undefined) {
    return '?';
  }

  if (cost === 'unplayable') {
    return '—';
  }

  return String(cost);
}
