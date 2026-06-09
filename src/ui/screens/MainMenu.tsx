import { useGameStore } from '../../game/store/useGameStore';
import { getTerminology } from '../terminology/terminology';

export function MainMenu() {
  const startNewRun = useGameStore((state) => state.startNewRun);
  const continueRun = useGameStore((state) => state.continueRun);
  const openSettings = useGameStore((state) => state.openSettings);
  const openRunHistory = useGameStore((state) => state.openRunHistory);
  const canContinueRun = useGameStore((state) => state.canContinueRun);
  const settings = useGameStore((state) => state.settings);
  const terminology = getTerminology(settings.mode);
  const copy =
    settings.mode === 'stealth'
      ? '进入本地离线流程，沿常规会话、重点事项、整理节点和最终议题推进。'
      : '选择原创职业「铁誓者」，进入分支路线，完成战斗、奖励、休整点和 Boss 占位战。';

  return (
    <main className="app-shell main-menu">
      <section className="menu-panel">
        <p className="eyebrow">{terminology.menuEyebrow}</p>
        <h1 className="menu-title">{terminology.menuTitle}</h1>
        <p className="menu-copy">{copy}</p>
        <div className="button-row">
          {canContinueRun ? (
            <button className="primary-button" onClick={continueRun}>
              {settings.mode === 'stealth' ? '继续流程' : '继续 Run'}
            </button>
          ) : null}
          <button className="primary-button" onClick={() => startNewRun()}>
            {settings.mode === 'stealth' ? '开始流程' : '开始 Run'}
          </button>
          <button className="secondary-button" onClick={openRunHistory}>
            {settings.mode === 'stealth' ? '查看记录' : '运行记录'}
          </button>
          <button className="secondary-button" onClick={openSettings}>
            设置
          </button>
        </div>
      </section>
    </main>
  );
}
