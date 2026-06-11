import { useGameStore } from '../../game/store/useGameStore';
import type { EventChoice, EventState, UserSettings } from '../../game/types';

export function EventScreen() {
  const run = useGameStore((state) => state.run);
  const settings = useGameStore((state) => state.settings);
  const chooseEventChoice = useGameStore((state) => state.chooseEventChoice);
  const openSettings = useGameStore((state) => state.openSettings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);

  return (
    <EventScreenView
      chooseEventChoice={chooseEventChoice}
      event={run?.currentEvent}
      openSettings={openSettings}
      returnToMenu={returnToMenu}
      settings={settings}
    />
  );
}

interface EventScreenViewProps {
  event?: EventState;
  settings: UserSettings;
  chooseEventChoice: (choiceId: string) => void;
  openSettings: () => void;
  returnToMenu: () => void;
}

export function EventScreenView({
  event,
  settings,
  chooseEventChoice,
  openSettings,
  returnToMenu,
}: EventScreenViewProps) {
  if (!event) {
    return (
      <main className="app-shell reward-shell">
        <section className="reward-panel">
          <h1>{settings.mode === 'stealth' ? '事项' : '事件'}</h1>
          <button className="primary-button" onClick={returnToMenu}>
            {settings.mode === 'stealth' ? '返回入口' : '返回主菜单'}
          </button>
        </section>
      </main>
    );
  }

  const title = settings.mode === 'stealth' ? event.lowProfileName : event.name;
  const description = settings.mode === 'stealth' ? event.lowProfileDescription : event.description;

  return (
    <main className="app-shell reward-shell event-shell">
      <section className="reward-panel event-panel">
        <div className="screen-header">
          <div>
            <p className="eyebrow">{settings.mode === 'stealth' ? '事项' : event.kind === 'major' ? '大事件' : '事件'}</p>
            <h1>{title}</h1>
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={openSettings}>
              设置
            </button>
            <button className="secondary-button" onClick={returnToMenu}>
              {settings.mode === 'stealth' ? '返回入口' : '返回主菜单'}
            </button>
          </div>
        </div>

        <p className="menu-copy">{description}</p>

        {event.resultLog.length > 0 ? (
          <div className="event-result" aria-label={settings.mode === 'stealth' ? '结果' : '事件结果'}>
            {event.resultLog.map((entry, index) => (
              <p key={`${entry}-${index}`}>{entry}</p>
            ))}
          </div>
        ) : null}

        <div className="event-choice-list">
          {event.choices.map((choice) => (
            <EventChoiceButton
              choice={choice}
              key={choice.id}
              mode={settings.mode}
              onChoose={chooseEventChoice}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

interface EventChoiceButtonProps {
  choice: EventChoice;
  mode: UserSettings['mode'];
  onChoose: (choiceId: string) => void;
}

function EventChoiceButton({ choice, mode, onChoose }: EventChoiceButtonProps) {
  const label = mode === 'stealth' ? choice.lowProfileLabel : choice.label;
  const description = mode === 'stealth' ? choice.lowProfileDescription : choice.description;
  const disabled = choice.status === 'locked' || choice.status === 'blocked';
  const statusText =
    choice.status === 'blocked'
      ? mode === 'stealth'
        ? '暂缓'
        : 'Blocked'
      : choice.status === 'locked'
        ? mode === 'stealth'
          ? '条件不足'
          : 'Locked'
        : undefined;

  return (
    <button
      className="event-choice-button"
      data-status={choice.status ?? 'available'}
      disabled={disabled}
      onClick={() => onChoose(choice.id)}
    >
      <strong>{label}</strong>
      <span>{description}</span>
      {statusText ? <span className="event-choice-status">{statusText}</span> : null}
      {choice.lockedReason ? <span className="relic-description">{choice.lockedReason}</span> : null}
    </button>
  );
}
