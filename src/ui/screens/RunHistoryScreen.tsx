import { useGameStore } from '../../game/store/useGameStore';

export function RunHistoryScreen() {
  const runHistory = useGameStore((state) => state.runHistory);
  const settings = useGameStore((state) => state.settings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);
  const openSettings = useGameStore((state) => state.openSettings);
  const title = settings.mode === 'stealth' ? '记录面板' : '运行记录';

  return (
    <main className="app-shell history-shell">
      <section className="history-panel">
        <div className="screen-header">
          <div>
            <p className="eyebrow">{settings.mode === 'stealth' ? '本地留存' : '本地历史'}</p>
            <h1>{title}</h1>
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={openSettings}>
              设置
            </button>
            <button className="primary-button" onClick={returnToMenu}>
              返回主菜单
            </button>
          </div>
        </div>

        {runHistory.length === 0 ? (
          <p className="settings-note">暂无记录。</p>
        ) : (
          <div className="history-list">
            {runHistory.map((summary) => (
              <article className="history-item" key={summary.id}>
                <div>
                  <h2>{settings.mode === 'stealth' ? summary.lowProfileTitle : resultLabel(summary.status)}</h2>
                  <p>{new Date(summary.completedAt).toLocaleString()}</p>
                </div>
                <dl className="history-stats">
                  <div>
                    <dt>Floor</dt>
                    <dd>{summary.floorReached}</dd>
                  </div>
                  <div>
                    <dt>HP</dt>
                    <dd>
                      {summary.finalHp}/{summary.maxHp}
                    </dd>
                  </div>
                  <div>
                    <dt>Gold</dt>
                    <dd>{summary.gold}</dd>
                  </div>
                  <div>
                    <dt>Deck</dt>
                    <dd>{summary.deckSize}</dd>
                  </div>
                  <div>
                    <dt>Relic</dt>
                    <dd>{summary.relicCount}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function resultLabel(status: string): string {
  return status === 'victory' ? '试炼完成' : status === 'defeat' ? '试炼失败' : '进行中';
}
