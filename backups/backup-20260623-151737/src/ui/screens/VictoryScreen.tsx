import { useGameStore } from '../../game/store/useGameStore';
import { getTerminology } from '../terminology/terminology';

export function VictoryScreen() {
  const run = useGameStore((state) => state.run);
  const summary = useGameStore((state) => state.lastRunSummary ?? state.run?.currentSummary);
  const settings = useGameStore((state) => state.settings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);
  const openRunHistory = useGameStore((state) => state.openRunHistory);
  const terminology = getTerminology(settings.mode);
  const title = settings.mode === 'stealth' ? '流程完成' : '试炼完成';
  const displaySummary =
    summary ??
    (run
      ? {
          floorReached: run.floor,
          finalHp: run.character.hp,
          gold: run.character.gold,
          deckSize: run.deck.length,
          relicCount: run.relics.length,
        }
      : undefined);

  return (
    <main className="app-shell result-shell">
      <section className="result-panel">
        <p className="eyebrow">{settings.mode === 'stealth' ? '本地摘要' : '通关摘要'}</p>
        <h1>{title}</h1>
        {displaySummary ? (
          <dl className="summary-grid">
            <div>
              <dt>floorReached</dt>
              <dd>{displaySummary.floorReached}</dd>
            </div>
            <div>
              <dt>finalHp</dt>
              <dd>{displaySummary.finalHp}</dd>
            </div>
            <div>
              <dt>{terminology.gold}</dt>
              <dd>{displaySummary.gold}</dd>
            </div>
            <div>
              <dt>deckSize</dt>
              <dd>{displaySummary.deckSize}</dd>
            </div>
            <div>
              <dt>relicCount</dt>
              <dd>{displaySummary.relicCount}</dd>
            </div>
          </dl>
        ) : null}
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
