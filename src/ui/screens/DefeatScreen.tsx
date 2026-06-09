import { useGameStore } from '../../game/store/useGameStore';

export function DefeatScreen() {
  const summary = useGameStore((state) => state.lastRunSummary ?? state.run?.currentSummary);
  const settings = useGameStore((state) => state.settings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);
  const openRunHistory = useGameStore((state) => state.openRunHistory);
  const title = settings.mode === 'stealth' ? '流程中止' : '试炼失败';

  return (
    <main className="app-shell result-shell">
      <section className="result-panel">
        <p className="eyebrow">{settings.mode === 'stealth' ? '本地摘要' : '失败摘要'}</p>
        <h1>{title}</h1>
        {summary ? (
          <dl className="summary-grid">
            <div>
              <dt>floorReached</dt>
              <dd>{summary.floorReached}</dd>
            </div>
            <div>
              <dt>finalHp</dt>
              <dd>{summary.finalHp}</dd>
            </div>
            <div>
              <dt>gold</dt>
              <dd>{summary.gold}</dd>
            </div>
            <div>
              <dt>deckSize</dt>
              <dd>{summary.deckSize}</dd>
            </div>
            <div>
              <dt>relicCount</dt>
              <dd>{summary.relicCount}</dd>
            </div>
          </dl>
        ) : (
          <p>本次运行已结束。</p>
        )}
        <div className="button-row">
          <button className="primary-button" onClick={returnToMenu}>
            返回主菜单
          </button>
          <button className="secondary-button" onClick={openRunHistory}>
            查看运行记录
          </button>
        </div>
      </section>
    </main>
  );
}
