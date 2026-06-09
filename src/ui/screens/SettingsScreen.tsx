import { backgroundOptions, readLocalBackgroundFile } from '../../adapters/backgroundAdapter';
import type { BackgroundId, ThemeId } from '../../game/types';
import { useGameStore } from '../../game/store/useGameStore';
import { themeOptions } from '../themes/themeOptions';

export function SettingsScreen() {
  const settings = useGameStore((state) => state.settings);
  const closeSettings = useGameStore((state) => state.closeSettings);
  const setGameMode = useGameStore((state) => state.setGameMode);
  const setTheme = useGameStore((state) => state.setTheme);
  const setBackgroundId = useGameStore((state) => state.setBackgroundId);
  const setCustomBackground = useGameStore((state) => state.setCustomBackground);
  const setBackgroundOpacity = useGameStore((state) => state.setBackgroundOpacity);
  const setCompactMode = useGameStore((state) => state.setCompactMode);
  const clearLocalSettings = useGameStore((state) => state.clearLocalSettings);
  const clearLocalRun = useGameStore((state) => state.clearLocalRun);
  const runHistory = useGameStore((state) => state.runHistory);
  const exportJson = useGameStore((state) => state.exportJson);
  const importJson = useGameStore((state) => state.importJson);
  const importError = useGameStore((state) => state.importError);
  const exportRunHistory = useGameStore((state) => state.exportRunHistory);
  const setImportJson = useGameStore((state) => state.setImportJson);
  const importRunHistory = useGameStore((state) => state.importRunHistory);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const dataUrl = await readLocalBackgroundFile(file);
    setCustomBackground(dataUrl);
    event.target.value = '';
  };

  return (
    <main className="app-shell settings-shell">
      <section className="settings-panel">
        <div className="settings-header">
          <div>
            <p className="eyebrow">本地设置</p>
            <h1>显示与背景</h1>
          </div>
          <button className="secondary-button" onClick={closeSettings}>
            返回
          </button>
        </div>

        <section className="settings-section">
          <h2>模式</h2>
          <div className="segmented-control">
            <button
              className={settings.mode === 'normal' ? 'is-active' : ''}
              onClick={() => setGameMode('normal')}
            >
              普通
            </button>
            <button
              className={settings.mode === 'stealth' ? 'is-active' : ''}
              onClick={() => setGameMode('stealth')}
            >
              低调
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h2>主题</h2>
          <select value={settings.themeId} onChange={(event) => setTheme(event.target.value as ThemeId)}>
            {themeOptions.map((theme) => (
              <option key={theme.id} value={theme.id}>
                {theme.label}
              </option>
            ))}
          </select>
        </section>

        <section className="settings-section">
          <h2>背景</h2>
          <select
            value={settings.background.id}
            onChange={(event) => setBackgroundId(event.target.value as BackgroundId)}
          >
            {backgroundOptions.map((background) => (
              <option key={background.id} value={background.id}>
                {background.label}
              </option>
            ))}
          </select>
          <label className="file-control">
            <span>本地图片</span>
            <input accept="image/*" type="file" onChange={handleFileChange} />
          </label>
          <label className="range-control">
            <span>背景透明度</span>
            <input
              max="0.9"
              min="0"
              step="0.05"
              type="range"
              value={settings.background.opacity}
              onChange={(event) => setBackgroundOpacity(Number(event.target.value))}
            />
          </label>
        </section>

        <section className="settings-section">
          <label className="toggle-line">
            <input
              checked={settings.compactMode}
              type="checkbox"
              onChange={(event) => setCompactMode(event.target.checked)}
            />
            <span>紧凑模式</span>
          </label>
        </section>

        <section className="settings-section">
          <h2>本地存档</h2>
          <p className="settings-note">云同步：预留接口，当前未启用</p>
          <p className="settings-note">Run history：{runHistory.length} 条</p>
          <div className="button-row">
            <button className="secondary-button" onClick={clearLocalRun}>
              清空本地存档
            </button>
            <button className="secondary-button" onClick={exportRunHistory}>
              导出 run history JSON
            </button>
          </div>
          <textarea
            readOnly
            className="json-box"
            placeholder="导出的 run history JSON 会显示在这里。"
            value={exportJson}
          />
          <textarea
            className="json-box"
            placeholder="粘贴 run history JSON 后导入。"
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
          />
          {importError ? <p className="settings-error">{importError}</p> : null}
          <button className="secondary-button" onClick={importRunHistory}>
            导入 run history JSON
          </button>
        </section>

        <section className="settings-actions">
          <button className="secondary-button" onClick={clearLocalSettings}>
            清空本地设置
          </button>
        </section>
      </section>
    </main>
  );
}
