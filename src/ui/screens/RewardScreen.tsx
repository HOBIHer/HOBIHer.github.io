import { useState } from 'react';
import { warriorCardById } from '../../game/data/cards/warrior';
import { relicById } from '../../game/data/relics/relics';
import { useGameStore } from '../../game/store/useGameStore';
import type { RelicId, RewardBundle, UserSettings } from '../../game/types';
import { CardView } from '../components/CardView';
import { getTerminology } from '../terminology/terminology';

export function RewardScreen() {
  const pendingReward = useGameStore((state) => state.pendingReward);
  const settings = useGameStore((state) => state.settings);
  const claimReward = useGameStore((state) => state.claimReward);
  const skipReward = useGameStore((state) => state.skipReward);
  const openSettings = useGameStore((state) => state.openSettings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);

  return (
    <RewardScreenView
      claimReward={claimReward}
      openSettings={openSettings}
      pendingReward={pendingReward}
      returnToMenu={returnToMenu}
      settings={settings}
      skipReward={skipReward}
    />
  );
}

interface RewardScreenViewProps {
  pendingReward?: RewardBundle;
  settings: UserSettings;
  claimReward: (selectedCardId?: string, selectedRelicId?: string) => void;
  skipReward: () => void;
  openSettings: () => void;
  returnToMenu: () => void;
}

export function RewardScreenView({
  pendingReward,
  settings,
  claimReward,
  skipReward,
  openSettings,
  returnToMenu,
}: RewardScreenViewProps) {
  const terminology = getTerminology(settings.mode);
  const [selectedCardId, setSelectedCardId] = useState<string>();
  const [selectedRelicId, setSelectedRelicId] = useState<string>();
  const [claiming, setClaiming] = useState(false);

  if (!pendingReward) {
    return (
      <main className="app-shell reward-shell">
        <section className="reward-panel">
          <h1>{terminology.reward}</h1>
          <p>没有待处理的奖励。</p>
          <button className="primary-button" onClick={returnToMenu}>
            返回主菜单
          </button>
        </section>
      </main>
    );
  }

  const title = settings.mode === 'stealth' ? '处理结果' : '战利品';
  const selectCardText = settings.mode === 'stealth' ? '选择操作项' : '选择卡牌';
  const skipText = settings.mode === 'stealth' ? '跳过操作项' : '跳过卡牌';
  const claimText = settings.mode === 'stealth' ? '确认结果' : '领取奖励';
  const hasCards = pendingReward.cardChoices.length > 0;
  const canClaim = !claiming && (!hasCards || Boolean(selectedCardId));

  const handleClaim = () => {
    if (!canClaim) {
      return;
    }

    setClaiming(true);
    claimReward(selectedCardId, selectedRelicId);
  };

  const handleSkip = () => {
    if (claiming) {
      return;
    }

    setClaiming(true);
    skipReward();
  };

  return (
    <main className="app-shell reward-shell">
      <section className="reward-panel">
        <div className="screen-header">
          <div>
            <p className="eyebrow">{settings.mode === 'stealth' ? '节点输出' : '战斗结算'}</p>
            <h1>{title}</h1>
          </div>
          <button className="secondary-button" onClick={openSettings}>
            设置
          </button>
        </div>

        <div className="reward-summary">
          <span className="pile-chip">
            {terminology.gold} +{pendingReward.gold}
          </span>
          {pendingReward.relicChoices.length > 0 ? (
            <span className="pile-chip">
              {terminology.relic} {pendingReward.relicChoices.length}
            </span>
          ) : null}
        </div>

        {hasCards ? (
          <div>
            <h2 className="section-title">{selectCardText}</h2>
            <div className="reward-grid">
              {pendingReward.cardChoices.map((cardId) => (
                <div className="reward-choice" data-selected={selectedCardId === cardId} key={cardId}>
                  <CardView
                    card={warriorCardById[cardId]}
                    disabled={claiming}
                    mode={settings.mode}
                    onClick={() => setSelectedCardId(cardId)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="settings-note">
            {settings.mode === 'stealth' ? '最终议题已完成，确认后进入摘要。' : 'Boss 已击败，确认后进入通关摘要。'}
          </p>
        )}

        {pendingReward.relicChoices.length > 0 ? (
          <div className="relic-choice-list">
            {pendingReward.relicChoices.map((relicId) => {
              const relic = relicById[relicId as RelicId];
              const relicName =
                settings.mode === 'stealth' ? relic?.lowProfileName ?? relicId : relic?.name ?? relicId;
              const relicDescription =
                settings.mode === 'stealth'
                  ? relic?.lowProfileDescription
                  : relic?.description;
              return (
                <button
                  className="secondary-button"
                  data-selected={selectedRelicId === relicId}
                  disabled={claiming}
                  key={relicId}
                  onClick={() => setSelectedRelicId(relicId)}
                >
                  {terminology.relic}: {relicName}
                  {relicDescription ? <span className="relic-description">{relicDescription}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="reward-actions">
          {hasCards ? (
            <button className="secondary-button" disabled={claiming} onClick={handleSkip}>
              {skipText}
            </button>
          ) : null}
          <button className="primary-button" disabled={!canClaim} onClick={handleClaim}>
            {claimText}
          </button>
        </div>
      </section>
    </main>
  );
}
