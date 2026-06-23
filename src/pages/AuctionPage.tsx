import { Banknote, Gavel, PackagePlus, RefreshCw } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { ItemCard } from '../components/ItemCard'
import { formatNumber } from '../game/formulas'
import { useGame } from '../store/gameStore'

export function AuctionPage() {
  const {
    profile,
    items,
    auctionLots,
    generateDailyAuctions,
    closeDueAuctions,
    placeBid,
    createPlayerAuction,
    globalConfig,
  } = useGame()
  const [bidValues, setBidValues] = useState<Record<string, string>>({})
  const [listingItemId, setListingItemId] = useState('')
  const [startPrice, setStartPrice] = useState('100')

  if (!profile) return null

  async function bid(event: FormEvent, lotId: string) {
    event.preventDefault()
    const amount = Number(bidValues[lotId])
    if (Number.isFinite(amount)) await placeBid(lotId, Math.floor(amount))
  }

  async function createListing(event: FormEvent) {
    event.preventDefault()
    if (!listingItemId) return
    await createPlayerAuction(listingItemId, Math.max(1, Math.floor(Number(startPrice))))
    setListingItemId('')
  }

  const sellable = items.filter(
    (item) =>
      item.owner_id === profile.id &&
      !item.is_basic &&
      !item.is_locked &&
      item.id !== profile.equipped_method_id &&
      !profile.battle_strategy.includes(item.id),
  )

  return (
    <section className="page-stack">
      <div className="button-row">
        <button className="primary-button" onClick={() => void generateDailyAuctions()}>
          <RefreshCw size={18} /> 系统拍卖
        </button>
        <button className="secondary-button" onClick={() => void closeDueAuctions()}>
          <Gavel size={18} /> 结算
        </button>
      </div>

      <section className="list-stack">
        {auctionLots.length === 0 ? <div className="notice">暂无拍卖</div> : null}
        {auctionLots.map((lot) => {
          const item = lot.game_items
          const minBid = Math.max(lot.start_price, Math.ceil((lot.current_bid ?? 0) * (1 + globalConfig.auction_min_increment_pct)))
          const closes = new Date(lot.closes_at)
          return (
            <article className="panel" key={lot.id}>
              <div className="item-card__top">
                <div>
                  <h2>{item?.name ?? '未知物品'}</h2>
                  <p>
                    {lot.source === 'system' ? '系统' : '玩家'} · {lot.status}
                  </p>
                </div>
                <span className="badge">{closes.toLocaleString()}</span>
              </div>
              {item ? <ItemCard item={item} /> : null}
              <dl className="mini-grid">
                <div>
                  <dt>起拍</dt>
                  <dd>{formatNumber(lot.start_price)}</dd>
                </div>
                <div>
                  <dt>当前</dt>
                  <dd>{formatNumber(lot.current_bid ?? 0)}</dd>
                </div>
                <div>
                  <dt>最低</dt>
                  <dd>{formatNumber(minBid)}</dd>
                </div>
              </dl>
              <form className="inline-form" onSubmit={(event) => void bid(event, lot.id)}>
                <input
                  inputMode="numeric"
                  value={bidValues[lot.id] ?? String(minBid)}
                  onChange={(event) => setBidValues((values) => ({ ...values, [lot.id]: event.target.value }))}
                />
                <button className="secondary-button" disabled={lot.status !== 'active'}>
                  <Banknote size={16} /> 出价
                </button>
              </form>
            </article>
          )
        })}
      </section>

      <section className="panel">
        <h2>寄售</h2>
        <form className="stack-form" onSubmit={(event) => void createListing(event)}>
          <label>
            物品
            <select value={listingItemId} onChange={(event) => setListingItemId(event.target.value)}>
              <option value="">选择物品</option>
              {sellable.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            起拍价
            <input inputMode="numeric" value={startPrice} onChange={(event) => setStartPrice(event.target.value)} />
          </label>
          <button className="secondary-button">
            <PackagePlus size={16} /> 创建
          </button>
        </form>
      </section>
    </section>
  )
}
