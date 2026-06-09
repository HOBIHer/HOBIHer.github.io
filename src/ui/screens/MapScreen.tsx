import { canEnterNode } from '../../game/engine/map';
import type { MapNodeStatus, RunState, UserSettings } from '../../game/types';
import { useGameStore } from '../../game/store/useGameStore';
import { getTerminology } from '../terminology/terminology';

const statusLabel: Record<MapNodeStatus, string> = {
  current: '当前',
  available: '可进入',
  completed: '已完成',
  locked: '未解锁',
};

const stealthStatusLabel: Record<MapNodeStatus, string> = {
  current: '当前',
  available: '可处理',
  completed: '已完成',
  locked: '未开放',
};

export function MapScreen() {
  const run = useGameStore((state) => state.run);
  const settings = useGameStore((state) => state.settings);
  const enterMapNode = useGameStore((state) => state.enterMapNode);
  const openSettings = useGameStore((state) => state.openSettings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);

  return (
    <MapScreenView
      enterMapNode={enterMapNode}
      openSettings={openSettings}
      returnToMenu={returnToMenu}
      run={run}
      settings={settings}
    />
  );
}

interface MapScreenViewProps {
  run?: RunState;
  settings: UserSettings;
  enterMapNode: (nodeId: string) => void;
  openSettings: () => void;
  returnToMenu: () => void;
}

export function MapScreenView({
  run,
  settings,
  enterMapNode,
  openSettings,
  returnToMenu,
}: MapScreenViewProps) {
  const terminology = getTerminology(settings.mode);

  if (!run) {
    return (
      <main className="app-shell main-menu">
        <section className="menu-panel">
          <h1>没有进行中的路线</h1>
          <button className="primary-button" onClick={returnToMenu}>
            返回主菜单
          </button>
        </section>
      </main>
    );
  }

  const mapFloors = groupMapByFloor(run.map);

  return (
    <main className="app-shell map-shell">
      <header className="map-header">
        <div>
          <p className="eyebrow">Act {run.act}</p>
          <h1>{terminology.map}</h1>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={openSettings}>
            设置
          </button>
          <button className="secondary-button" onClick={returnToMenu}>
            返回主菜单
          </button>
        </div>
      </header>

      <section className="map-track map-track-branching" aria-label={terminology.map}>
        {mapFloors.map((floorNodes, floorIndex) => {
          const layer = floorNodes[0]?.layer ?? floorIndex;

          return (
            <div className="map-floor-wrap" key={layer}>
              <div className="map-floor-label">
                {settings.mode === 'stealth' ? `层级 ${layer + 1}` : `Layer ${layer + 1}`}
              </div>
              <div className="map-floor">
                {floorNodes.map((node) => {
                  const enterable = canEnterNode(run.map, node.id);
                  const label = settings.mode === 'stealth' ? node.lowProfileLabel : node.label;
                  const labels = settings.mode === 'stealth' ? stealthStatusLabel : statusLabel;

                  return (
                    <button
                      className={`map-node map-node-${node.type} map-node-${node.status}`}
                      disabled={!enterable}
                      key={node.id}
                      onClick={() => enterMapNode(node.id)}
                    >
                      <span className="map-node-index">{node.index + 1}</span>
                      <span className="map-node-label">{label}</span>
                      <span className="map-node-status">
                        {node.status === 'completed' ? '✓ ' : ''}
                        {labels[node.status]}
                      </span>
                    </button>
                  );
                })}
              </div>
              {floorIndex < mapFloors.length - 1 ? (
                <span className="map-edge map-edge-branching" aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </section>
    </main>
  );
}

function groupMapByFloor(map: RunState['map']): RunState['map'][] {
  const groups = new Map<number, RunState['map']>();

  for (const node of map) {
    const layer = node.layer ?? (node.floor ?? node.index + 1) - 1;
    groups.set(layer, [...(groups.get(layer) ?? []), node]);
  }

  return [...groups.entries()]
    .sort(([leftLayer], [rightLayer]) => rightLayer - leftLayer)
    .map(([, nodes]) => nodes.sort((left, right) => left.x - right.x || left.index - right.index));
}
