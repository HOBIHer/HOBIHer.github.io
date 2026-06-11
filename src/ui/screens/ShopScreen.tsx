import { warriorCardById } from '../../game/data/cards/warrior';
import { potionById } from '../../game/data/potions/potions';
import { relicById } from '../../game/data/relics/relics';
import { useGameStore } from '../../game/store/useGameStore';
import type { RunState, ShopItem, ShopState, UserSettings } from '../../game/types';
import { CardView } from '../components/CardView';
import { getTerminology } from '../terminology/terminology';

export function ShopScreen() {
  const run = useGameStore((state) => state.run);
  const settings = useGameStore((state) => state.settings);
  const buyShopItem = useGameStore((state) => state.buyShopItem);
  const leaveShop = useGameStore((state) => state.leaveShop);
  const openSettings = useGameStore((state) => state.openSettings);
  const returnToMenu = useGameStore((state) => state.returnToMenu);

  return (
    <ShopScreenView
      buyShopItem={buyShopItem}
      leaveShop={leaveShop}
      openSettings={openSettings}
      returnToMenu={returnToMenu}
      run={run}
      settings={settings}
      shop={run?.currentShop}
    />
  );
}

interface ShopScreenViewProps {
  run?: RunState;
  shop?: ShopState;
  settings: UserSettings;
  buyShopItem: (itemId: string) => void;
  leaveShop: () => void;
  openSettings: () => void;
  returnToMenu: () => void;
}

export function ShopScreenView({
  run,
  shop,
  settings,
  buyShopItem,
  leaveShop,
  openSettings,
  returnToMenu,
}: ShopScreenViewProps) {
  const terminology = getTerminology(settings.mode);

  if (!run || !shop) {
    return (
      <main className="app-shell reward-shell">
        <section className="reward-panel">
          <h1>{settings.mode === 'stealth' ? '资源面板' : '商店'}</h1>
          <button className="primary-button" onClick={returnToMenu}>
            {settings.mode === 'stealth' ? '返回入口' : '返回主菜单'}
          </button>
        </section>
      </main>
    );
  }

  const title = settings.mode === 'stealth' ? '资源面板' : '商店';
  const itemTitle = settings.mode === 'stealth' ? '兑换项' : '商品';
  const goldLabel = settings.mode === 'stealth' ? '额度' : terminology.gold;

  return (
    <main className="app-shell reward-shell shop-shell">
      <section className="reward-panel shop-panel">
        <div className="screen-header">
          <div>
            <p className="eyebrow">{settings.mode === 'stealth' ? '本地资源' : 'Shop'}</p>
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

        <div className="reward-summary">
          <span className="pile-chip">
            {goldLabel}: {run.character.gold}
          </span>
          <span className="pile-chip">
            {settings.mode === 'stealth' ? '补剂栏' : '药水栏'}: {run.potions.length}/{run.potionSlots}
          </span>
          <span className="pile-chip">
            {settings.mode === 'stealth' ? '清理报价' : '移除牌价格'}: {shop.removeCardPrice}
          </span>
        </div>

        <h2 className="section-title">{itemTitle}</h2>
        <div className="shop-grid">
          {shop.items.map((item) => (
            <ShopItemView
              buyShopItem={buyShopItem}
              item={item}
              key={item.id}
              mode={settings.mode}
              potionFull={run.potions.length >= run.potionSlots}
              runGold={run.character.gold}
            />
          ))}
        </div>

        <div className="reward-actions">
          <button className="primary-button" onClick={leaveShop}>
            {settings.mode === 'stealth' ? '离开资源面板' : '离开商店'}
          </button>
        </div>
      </section>
    </main>
  );
}

interface ShopItemViewProps {
  item: ShopItem;
  mode: UserSettings['mode'];
  runGold: number;
  potionFull: boolean;
  buyShopItem: (itemId: string) => void;
}

function ShopItemView({ item, mode, runGold, potionFull, buyShopItem }: ShopItemViewProps) {
  const disabled = item.sold || runGold < item.price || (item.type === 'potion' && potionFull);
  const priceText = mode === 'stealth' ? `额度 ${item.price}` : `${item.price} 金币`;
  const soldText = mode === 'stealth' ? '已兑换' : '已售出';

  if (item.type === 'card' && item.refId) {
    const card = warriorCardById[item.refId];
    return (
      <div className="shop-item" data-sold={item.sold}>
        {card ? (
          <CardView card={card} disabled={disabled} mode={mode} onClick={() => buyShopItem(item.id)} />
        ) : null}
        <button className="secondary-button" disabled={disabled} onClick={() => buyShopItem(item.id)}>
          {item.sold ? soldText : priceText}
        </button>
      </div>
    );
  }

  const name = getShopItemName(item, mode);
  const description = getShopItemDescription(item, mode);
  return (
    <button
      className="shop-item shop-item-button"
      data-sold={item.sold}
      disabled={disabled}
      onClick={() => buyShopItem(item.id)}
    >
      <strong>{name}</strong>
      <span>{description}</span>
      <span>{item.sold ? soldText : priceText}</span>
    </button>
  );
}

function getShopItemName(item: ShopItem, mode: UserSettings['mode']): string {
  if (item.type === 'relic' && item.refId) {
    const relic = relicById[item.refId];
    return mode === 'stealth' ? relic?.lowProfileName ?? item.refId : relic?.name ?? item.refId;
  }

  if (item.type === 'potion' && item.refId) {
    const potion = potionById[item.refId];
    return mode === 'stealth' ? potion?.lowProfileName ?? item.refId : potion?.name ?? item.refId;
  }

  return mode === 'stealth' ? '清理服务' : '移除牌';
}

function getShopItemDescription(item: ShopItem, mode: UserSettings['mode']): string {
  if (item.type === 'relic' && item.refId) {
    const relic = relicById[item.refId];
    return mode === 'stealth' ? relic?.lowProfileDescription ?? '' : relic?.description ?? '';
  }

  if (item.type === 'potion' && item.refId) {
    const potion = potionById[item.refId];
    return mode === 'stealth' ? potion?.lowProfileDescription ?? '' : potion?.description ?? '';
  }

  return mode === 'stealth' ? '移除一个负担项。' : '移除一张牌。';
}
