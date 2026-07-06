import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Download, Eye, FileJson, Pencil, Plus, Save, Trash2, Trophy, Upload, UserRound, X } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CountryMoneyStat,
  ComputedRecord,
  GuessLeg,
  GuessRecord,
  GuessUser,
  NEGATIVE_RANKS,
  PickResult,
  POSITIVE_RANKS,
  RankInfo,
  ScoreTimelinePoint,
  buildCountryMoneyStats,
  buildScoreTimeline,
  computeRecord,
  computeUserStats,
  formatMoney,
} from '../game/guessSaint'

const STORAGE_KEY = 'worldcup-guess-saint:v1'
const pickOptions: Array<{ value: PickResult; label: string }> = [
  { value: 'win', label: '胜' },
  { value: 'draw', label: '平' },
  { value: 'lose', label: '负' },
]
const handicapOptions = Array.from({ length: 11 }, (_, index) => index - 5)

interface UserFormState {
  name: string
  avatarDataUrl?: string
}

interface ImportPayload {
  version: number
  exportedAt?: string
  users: GuessUser[]
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function createLeg(): GuessLeg {
  return {
    id: makeId('leg'),
    homeTeam: '',
    awayTeam: '',
    handicap: 0,
    pick: 'win',
    homeScore: 0,
    awayScore: 0,
  }
}

function createRecordDraft(): GuessRecord {
  const now = nowIso()
  return {
    id: makeId('record'),
    date: today(),
    legs: [createLeg()],
    stake: 100,
    odds: 1.9,
    createdAt: now,
    updatedAt: now,
  }
}

function sanitizeUsers(value: unknown): GuessUser[] {
  if (!Array.isArray(value)) return []
  return value
    .map((user): GuessUser | null => {
      if (!user || typeof user !== 'object') return null
      const source = user as Partial<GuessUser>
      const now = nowIso()
      const records = Array.isArray(source.records) ? source.records : []
      return {
        id: typeof source.id === 'string' ? source.id : makeId('user'),
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : '无名之人',
        avatarDataUrl: typeof source.avatarDataUrl === 'string' ? source.avatarDataUrl : undefined,
        records: records.map(sanitizeRecord).filter(Boolean) as GuessRecord[],
        createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
        updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
      }
    })
    .filter(Boolean) as GuessUser[]
}

function sanitizeRecord(record: unknown): GuessRecord | null {
  if (!record || typeof record !== 'object') return null
  const source = record as Partial<GuessRecord>
  const now = nowIso()
  const legs = Array.isArray(source.legs) ? source.legs : []
  return {
    id: typeof source.id === 'string' ? source.id : makeId('record'),
    date: typeof source.date === 'string' ? source.date : today(),
    legs: legs.map(sanitizeLeg).filter(Boolean) as GuessLeg[],
    stake: Number(source.stake || 0),
    odds: Number(source.odds || 0),
    batchGroupId: typeof source.batchGroupId === 'string' ? source.batchGroupId : undefined,
    batchParticipantCount: Number(source.batchParticipantCount || 0) || undefined,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
  }
}

function sanitizeLeg(leg: unknown): GuessLeg | null {
  if (!leg || typeof leg !== 'object') return null
  const source = leg as Partial<GuessLeg>
  const pick: PickResult = source.pick === 'draw' || source.pick === 'lose' ? source.pick : 'win'
  return {
    id: typeof source.id === 'string' ? source.id : makeId('leg'),
    homeTeam: typeof source.homeTeam === 'string' ? source.homeTeam : '',
    awayTeam: typeof source.awayTeam === 'string' ? source.awayTeam : '',
    handicap: Number(source.handicap || 0),
    pick,
    homeScore: Number(source.homeScore || 0),
    awayScore: Number(source.awayScore || 0),
  }
}

function loadUsers(): GuessUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ImportPayload
    return sanitizeUsers(parsed.users)
  } catch {
    return []
  }
}

function readAvatar(event: ChangeEvent<HTMLInputElement>, onLoad: (dataUrl: string) => void) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') onLoad(reader.result)
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

function validateRecord(record: GuessRecord): string | null {
  if (!record.date) return '请选择竞猜日期'
  if (record.stake <= 0) return '下注金额必须大于 0'
  if (record.odds <= 0) return '赔率必须大于 0'
  if (!record.legs.length) return '至少保留 1 个关卡'
  const emptyLeg = record.legs.find((leg) => !leg.homeTeam.trim() || !leg.awayTeam.trim())
  if (emptyLeg) return '每个关卡都要填写比赛队伍'
  return null
}

export function WorldCupGuessSaintPage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [users, setUsers] = useState<GuessUser[]>(loadUsers)
  const [userForm, setUserForm] = useState<UserFormState>({ name: '' })
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [userError, setUserError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [recordDraft, setRecordDraft] = useState<GuessRecord>(createRecordDraft)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [recordError, setRecordError] = useState<string | null>(null)
  const [batchDraft, setBatchDraft] = useState<GuessRecord>(createRecordDraft)
  const [batchStakes, setBatchStakes] = useState<Record<string, string>>({})
  const [batchError, setBatchError] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')

  const statsByUser = useMemo(() => new Map(users.map((user) => [user.id, computeUserStats(user)])), [users])
  const activeUser = userId ? users.find((user) => user.id === userId) ?? null : null
  const activeStats = activeUser ? statsByUser.get(activeUser.id) ?? computeUserStats(activeUser) : null
  const activeScoreTimeline = useMemo(() => (activeStats ? buildScoreTimeline(activeStats.computedRecords) : []), [activeStats])
  const activeCountryStats = useMemo(() => (activeStats ? buildCountryMoneyStats(activeStats.computedRecords) : []), [activeStats])
  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return users
    return users.filter((user) => user.name.toLowerCase().includes(keyword))
  }, [query, users])
  const previewRecord = useMemo(
    () => computeRecord(recordDraft, activeUser?.records.length ?? 0),
    [activeUser?.records.length, recordDraft],
  )
  const batchParticipants = useMemo(
    () =>
      users
        .filter((user) => batchStakes[user.id] !== undefined)
        .map((user) => ({ user, stake: Number(batchStakes[user.id]) })),
    [batchStakes, users],
  )
  const batchTotalStake = batchParticipants.reduce((sum, { stake }) => (Number.isFinite(stake) && stake > 0 ? sum + stake : sum), 0)
  const batchPreviewRecord = useMemo(
    () => computeRecord({ ...batchDraft, stake: batchTotalStake || batchDraft.stake }, 0),
    [batchDraft, batchTotalStake],
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, users }))
  }, [users])

  useEffect(() => {
    if (userId && !activeUser) navigate('/guess-saint', { replace: true })
  }, [activeUser, navigate, userId])

  useEffect(() => {
    setProfileName(activeUser?.name ?? '')
    setRecordDraft(createRecordDraft())
    setEditingRecordId(null)
    setRecordError(null)
  }, [activeUser?.id])

  function upsertUser(event: FormEvent) {
    event.preventDefault()
    const name = userForm.name.trim()
    if (!name) {
      setUserError('先给土块起个名字')
      return
    }
    setUserError(null)
    const now = nowIso()

    if (editingUserId) {
      setUsers((current) =>
        current.map((user) =>
          user.id === editingUserId ? { ...user, name, avatarDataUrl: userForm.avatarDataUrl, updatedAt: now } : user,
        ),
      )
    } else {
      setUsers((current) => [
        ...current,
        {
          id: makeId('user'),
          name,
          avatarDataUrl: userForm.avatarDataUrl,
          records: [],
          createdAt: now,
          updatedAt: now,
        },
      ])
    }

    setUserForm({ name: '' })
    setEditingUserId(null)
  }

  function startEditUser(user: GuessUser) {
    setEditingUserId(user.id)
    setUserForm({ name: user.name, avatarDataUrl: user.avatarDataUrl })
    setUserError(null)
  }

  function deleteUser(id: string) {
    const user = users.find((item) => item.id === id)
    if (!user || !window.confirm(`删除 ${user.name} 和全部竞猜记录？`)) return
    setUsers((current) => current.filter((item) => item.id !== id))
    if (userId === id) navigate('/guess-saint')
  }

  function updateActiveUser(updater: (user: GuessUser) => GuessUser) {
    if (!activeUser) return
    setUsers((current) => current.map((user) => (user.id === activeUser.id ? updater(user) : user)))
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault()
    const name = profileName.trim()
    if (!name) return
    updateActiveUser((user) => ({ ...user, name, updatedAt: nowIso() }))
  }

  function exportData() {
    const payload: ImportPayload = { version: 1, exportedAt: nowIso(), users }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `worldcup-guess-saint-${today()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as Partial<ImportPayload> | GuessUser[]
      const nextUsers = sanitizeUsers(Array.isArray(parsed) ? parsed : parsed.users)
      if (!nextUsers.length) {
        setUserError('导入文件里没有可用用户数据')
        return
      }
      if (!window.confirm(`导入 ${nextUsers.length} 个用户并覆盖当前本地数据？`)) return
      setUsers(nextUsers)
      navigate('/guess-saint')
      setUserError(null)
    } catch {
      setUserError('导入失败，请确认是导出的 JSON 文件')
    } finally {
      event.target.value = ''
    }
  }

  function updateLeg(id: string, patch: Partial<GuessLeg>) {
    setRecordDraft((current) => ({
      ...current,
      legs: current.legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)),
    }))
  }

  function addLeg() {
    setRecordDraft((current) => ({ ...current, legs: [...current.legs, createLeg()] }))
  }

  function removeLeg(id: string) {
    setRecordDraft((current) => {
      if (current.legs.length === 1) return current
      return { ...current, legs: current.legs.filter((leg) => leg.id !== id) }
    })
  }

  function updateBatchLeg(id: string, patch: Partial<GuessLeg>) {
    setBatchDraft((current) => ({
      ...current,
      legs: current.legs.map((leg) => (leg.id === id ? { ...leg, ...patch } : leg)),
    }))
  }

  function addBatchLeg() {
    setBatchDraft((current) => ({ ...current, legs: [...current.legs, createLeg()] }))
  }

  function removeBatchLeg(id: string) {
    setBatchDraft((current) => {
      if (current.legs.length === 1) return current
      return { ...current, legs: current.legs.filter((leg) => leg.id !== id) }
    })
  }

  function toggleBatchUser(id: string, checked: boolean) {
    setBatchStakes((current) => {
      if (!checked) {
        const next = { ...current }
        delete next[id]
        return next
      }
      return { ...current, [id]: current[id] || String(batchDraft.stake || 100) }
    })
  }

  function updateBatchStake(id: string, value: string) {
    setBatchStakes((current) => ({ ...current, [id]: value }))
  }

  function saveBatchRecord(event: FormEvent) {
    event.preventDefault()
    const contentError = validateRecord({ ...batchDraft, stake: batchTotalStake || batchDraft.stake })
    if (contentError) {
      setBatchError(contentError)
      return
    }

    if (!batchParticipants.length) {
      setBatchError('至少选择一个合买用户，并填写购买金额')
      return
    }

    const invalidParticipant = batchParticipants.find(({ stake }) => !Number.isFinite(stake) || stake <= 0)
    if (invalidParticipant) {
      setBatchError('每个合买用户的购买金额都必须大于 0')
      return
    }

    setBatchError(null)
    const now = nowIso()
    const batchGroupId = makeId('batch')
    const normalizedLegs = batchDraft.legs.map((leg) => ({
      ...leg,
      homeTeam: leg.homeTeam.trim(),
      awayTeam: leg.awayTeam.trim(),
    }))

    setUsers((current) =>
      current.map((user) => {
        const participant = batchParticipants.find(({ user: participantUser }) => participantUser.id === user.id)
        if (!participant) return user
        return {
          ...user,
          records: [
            ...user.records,
            {
              ...batchDraft,
              id: makeId('record'),
              legs: normalizedLegs.map((leg) => ({ ...leg, id: makeId('leg') })),
              stake: participant.stake,
              odds: Number(batchDraft.odds),
              batchGroupId,
              batchParticipantCount: batchParticipants.length,
              createdAt: now,
              updatedAt: now,
            },
          ],
          updatedAt: now,
        }
      }),
    )

    setBatchDraft(createRecordDraft())
    setBatchStakes({})
  }

  function saveRecord(event: FormEvent) {
    event.preventDefault()
    if (!activeUser) return
    const error = validateRecord(recordDraft)
    if (error) {
      setRecordError(error)
      return
    }

    setRecordError(null)
    const now = nowIso()
    const normalized: GuessRecord = {
      ...recordDraft,
      legs: recordDraft.legs.map((leg) => ({
        ...leg,
        homeTeam: leg.homeTeam.trim(),
        awayTeam: leg.awayTeam.trim(),
      })),
      stake: Number(recordDraft.stake),
      odds: Number(recordDraft.odds),
      updatedAt: now,
    }

    updateActiveUser((user) => {
      const records = editingRecordId
        ? user.records.map((record) => (record.id === editingRecordId ? { ...normalized, id: editingRecordId } : record))
        : [...user.records, { ...normalized, id: makeId('record'), createdAt: now }]
      return { ...user, records, updatedAt: now }
    })
    setRecordDraft(createRecordDraft())
    setEditingRecordId(null)
  }

  function editRecord(record: ComputedRecord) {
    const original = activeUser?.records.find((item) => item.id === record.id)
    if (!original) return
    setEditingRecordId(original.id)
    setRecordDraft({
      ...original,
      legs: original.legs.map((leg) => ({ ...leg })),
    })
    setRecordError(null)
  }

  function deleteRecord(id: string) {
    if (!activeUser || !window.confirm('删除这条竞猜记录？')) return
    updateActiveUser((user) => ({
      ...user,
      records: user.records.filter((record) => record.id !== id),
      updatedAt: nowIso(),
    }))
    if (editingRecordId === id) {
      setEditingRecordId(null)
      setRecordDraft(createRecordDraft())
    }
  }

  if (activeUser && activeStats) {
    return (
      <main className="guess-page">
        <div className="guess-shell">
          <header className="guess-topbar">
            <button className="guess-ghost-button" onClick={() => navigate('/guess-saint')} type="button">
              <ArrowLeft size={18} />
              返回榜单
            </button>
            <Link className="guess-ghost-button" to="/">
              返回入口
            </Link>
          </header>

          <section className="guess-detail-hero">
            <div className="guess-avatar guess-avatar--large">
              {activeUser.avatarDataUrl ? <img src={activeUser.avatarDataUrl} alt={`${activeUser.name}头像`} /> : <UserRound size={42} />}
            </div>
            <div>
              <span className="guess-kicker">世界杯土块</span>
              <h1>{activeUser.name}</h1>
              <p>一边入圣，一边成怪。猜得准是功德，猜得歪也是修为。</p>
            </div>
            <div className="guess-hero-stats">
              <StatPill label="段位" value={activeStats.rank.label} />
              <StatPill label="段位分" value={`${activeStats.score}`} />
              <StatPill label="总盈亏" value={formatMoney(activeStats.totalProfit)} tone={activeStats.totalProfit >= 0 ? 'good' : 'bad'} />
            </div>
          </section>

          <section className="guess-layout">
            <div className="guess-main-stack">
              <section className="guess-panel">
                <div className="guess-section-head">
                  <div>
                    <h2>段位轴</h2>
                    <p>正中间 0 分，向右成圣，向左成怪。</p>
                  </div>
                </div>
                <RankAxis rank={activeStats.rank} />
              </section>

              <section className="guess-panel">
                <div className="guess-section-head">
                  <div>
                    <h2>分数走势</h2>
                  </div>
                </div>
                <ScoreTrendChart points={activeScoreTimeline} />
              </section>

              <section className="guess-panel">
                <div className="guess-section-head">
                  <div>
                    <h2>国家盈亏归因</h2>
                  </div>
                </div>
                <CountryMoneyChart stats={activeCountryStats} />
              </section>

              <section className="guess-panel">
                <div className="guess-section-head">
                  <div>
                    <h2>{editingRecordId ? '编辑竞猜记录' : '新增竞猜记录'}</h2>
                    <p>收入、净盈亏、命中结果、段位分影响都会自动计算。</p>
                  </div>
                  {editingRecordId ? (
                    <button
                      className="guess-icon-button"
                      onClick={() => {
                        setEditingRecordId(null)
                        setRecordDraft(createRecordDraft())
                      }}
                      title="取消编辑"
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  ) : null}
                </div>

                <form className="guess-record-form" onSubmit={saveRecord}>
                  <div className="guess-form-grid">
                    <label>
                      日期
                      <input value={recordDraft.date} type="date" onChange={(event) => setRecordDraft({ ...recordDraft, date: event.target.value })} />
                    </label>
                    <label>
                      下注金额
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={recordDraft.stake}
                        onChange={(event) => setRecordDraft({ ...recordDraft, stake: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      下注赔率
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={recordDraft.odds}
                        onChange={(event) => setRecordDraft({ ...recordDraft, odds: Number(event.target.value) })}
                      />
                    </label>
                  </div>

                  <div className="guess-leg-list">
                    {recordDraft.legs.map((leg, index) => (
                      <div className="guess-leg-row" key={leg.id}>
                        <div className="guess-leg-row__title">
                          <strong>关卡 {index + 1}</strong>
                          <button className="guess-icon-button" disabled={recordDraft.legs.length === 1} onClick={() => removeLeg(leg.id)} title="删除关卡" type="button">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="guess-form-grid guess-form-grid--legs">
                          <label>
                            主队
                            <input value={leg.homeTeam} onChange={(event) => updateLeg(leg.id, { homeTeam: event.target.value })} />
                          </label>
                          <label>
                            客队
                            <input value={leg.awayTeam} onChange={(event) => updateLeg(leg.id, { awayTeam: event.target.value })} />
                          </label>
                          <label>
                            让球
                            <select value={leg.handicap} onChange={(event) => updateLeg(leg.id, { handicap: Number(event.target.value) })}>
                              {handicapOptions.map((value) => (
                                <option key={value} value={value}>
                                  {value > 0 ? `+${value}` : value}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            猜测
                            <select value={leg.pick} onChange={(event) => updateLeg(leg.id, { pick: event.target.value as PickResult })}>
                              {pickOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            主队比分
                            <input
                              min="0"
                              step="1"
                              type="number"
                              value={leg.homeScore}
                              onChange={(event) => updateLeg(leg.id, { homeScore: Number(event.target.value) })}
                            />
                          </label>
                          <label>
                            客队比分
                            <input
                              min="0"
                              step="1"
                              type="number"
                              value={leg.awayScore}
                              onChange={(event) => updateLeg(leg.id, { awayScore: Number(event.target.value) })}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="guess-form-actions">
                    <button className="guess-secondary-button" onClick={addLeg} type="button">
                      <Plus size={18} />
                      加一关
                    </button>
                    <button className="guess-primary-button" type="submit">
                      <Save size={18} />
                      {editingRecordId ? '保存记录' : '加入记录'}
                    </button>
                  </div>
                </form>

                {recordError ? <div className="guess-alert guess-alert--bad">{recordError}</div> : null}
                <RecordPreview record={previewRecord} />
              </section>

              <section className="guess-panel">
                <div className="guess-section-head">
                  <div>
                    <h2>竞猜记录</h2>
                    <p>预测串、实际串、盈亏和段位分影响都来自记录自动计算。</p>
                  </div>
                </div>
                <RecordsTable records={activeStats.computedRecords} onEdit={editRecord} onDelete={deleteRecord} />
              </section>
            </div>

            <aside className="guess-side-stack">
              <section className="guess-panel">
                <div className="guess-section-head">
                  <div>
                    <h2>土块档案</h2>
                    <p>头像会随本地数据一起导出。</p>
                  </div>
                </div>
                <form className="guess-profile-form" onSubmit={saveProfile}>
                  <label>
                    用户名
                    <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
                  </label>
                  <label className="guess-file-button">
                    <Upload size={18} />
                    上传头像
                    <input accept="image/*" type="file" onChange={(event) => readAvatar(event, (avatarDataUrl) => updateActiveUser((user) => ({ ...user, avatarDataUrl })))} />
                  </label>
                  <button className="guess-primary-button" type="submit">
                    <Save size={18} />
                    保存档案
                  </button>
                </form>
              </section>

              <RankRules />
            </aside>
          </section>
        </div>
      </main>
    )
  }

  const totalRecords = users.reduce((sum, user) => sum + user.records.length, 0)
  const totalProfit = users.reduce((sum, user) => sum + (statsByUser.get(user.id)?.totalProfit ?? 0), 0)

  return (
    <main className="guess-page">
      <div className="guess-shell">
        <header className="guess-home-hero">
          <div>
            <span className="guess-kicker">土块封神榜</span>
            <h1>世界杯土块</h1>
            <p>记录每位土块的一生。</p>
          </div>
          <div className="guess-home-actions">
            <Link className="guess-ghost-button" to="/">
              返回入口
            </Link>
            <button className="guess-secondary-button" onClick={exportData} type="button">
              <Download size={18} />
              导出数据
            </button>
            <label className="guess-secondary-button guess-import-button">
              <Upload size={18} />
              导入数据
              <input accept="application/json" type="file" onChange={importData} />
            </label>
          </div>
        </header>

        <section className="guess-score-strip">
          <StatPill label="土块" value={`${users.length}`} />
          <StatPill label="竞猜记录" value={`${totalRecords}`} />
          <StatPill label="总盈亏" value={formatMoney(totalProfit)} tone={totalProfit >= 0 ? 'good' : 'bad'} />
        </section>

        <section className="guess-panel guess-batch-panel">
          <div className="guess-section-head">
            <div>
              <h2>合买批量入账</h2>
              <p>竞猜内容只填一次，选择参与用户和各自购买金额后，会批量写入每个用户的记录里。</p>
            </div>
          </div>

          <form className="guess-record-form" onSubmit={saveBatchRecord}>
            <div className="guess-form-grid">
              <label>
                日期
                <input value={batchDraft.date} type="date" onChange={(event) => setBatchDraft({ ...batchDraft, date: event.target.value })} />
              </label>
              <label>
                下注赔率
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={batchDraft.odds}
                  onChange={(event) => setBatchDraft({ ...batchDraft, odds: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="guess-leg-list">
              {batchDraft.legs.map((leg, index) => (
                <div className="guess-leg-row" key={leg.id}>
                  <div className="guess-leg-row__title">
                    <strong>合买关卡 {index + 1}</strong>
                    <button className="guess-icon-button" disabled={batchDraft.legs.length === 1} onClick={() => removeBatchLeg(leg.id)} title="删除关卡" type="button">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="guess-form-grid guess-form-grid--legs">
                    <label>
                      主队
                      <input value={leg.homeTeam} onChange={(event) => updateBatchLeg(leg.id, { homeTeam: event.target.value })} />
                    </label>
                    <label>
                      客队
                      <input value={leg.awayTeam} onChange={(event) => updateBatchLeg(leg.id, { awayTeam: event.target.value })} />
                    </label>
                    <label>
                      让球
                      <select value={leg.handicap} onChange={(event) => updateBatchLeg(leg.id, { handicap: Number(event.target.value) })}>
                        {handicapOptions.map((value) => (
                          <option key={value} value={value}>
                            {value > 0 ? `+${value}` : value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      猜测
                      <select value={leg.pick} onChange={(event) => updateBatchLeg(leg.id, { pick: event.target.value as PickResult })}>
                        {pickOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      主队比分
                      <input
                        min="0"
                        step="1"
                        type="number"
                        value={leg.homeScore}
                        onChange={(event) => updateBatchLeg(leg.id, { homeScore: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      客队比分
                      <input
                        min="0"
                        step="1"
                        type="number"
                        value={leg.awayScore}
                        onChange={(event) => updateBatchLeg(leg.id, { awayScore: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="guess-section-head guess-section-head--compact">
              <div>
                <h3>合买参与人</h3>
                <p>勾选参与合买的用户，并填写每个人购买了多少金额。</p>
              </div>
            </div>

            <div className="guess-batch-users">
              {users.length ? (
                users.map((user) => {
                  const selected = batchStakes[user.id] !== undefined
                  const stats = statsByUser.get(user.id) ?? computeUserStats(user)
                  return (
                    <div className="guess-batch-user" key={user.id}>
                      <label className="guess-batch-user__check">
                        <input checked={selected} type="checkbox" onChange={(event) => toggleBatchUser(user.id, event.target.checked)} />
                        <span>
                          <strong>{user.name}</strong>
                          <small>{stats.rank.label} / {formatMoney(stats.totalProfit)}</small>
                        </span>
                      </label>
                      <label>
                        购买金额
                        <input
                          disabled={!selected}
                          min="0"
                          step="0.01"
                          type="number"
                          value={batchStakes[user.id] ?? ''}
                          onChange={(event) => updateBatchStake(user.id, event.target.value)}
                        />
                      </label>
                    </div>
                  )
                })
              ) : (
                <div className="guess-empty">
                  <Trophy size={34} />
                  <p>先新增用户，再使用合买批量入账。</p>
                </div>
              )}
            </div>

            <div className="guess-form-actions">
              <button className="guess-secondary-button" onClick={addBatchLeg} type="button">
                <Plus size={18} />
                加一关
              </button>
              <button className="guess-primary-button" disabled={!users.length} type="submit">
                <Save size={18} />
                批量加入记录
              </button>
            </div>
          </form>

          {batchError ? <div className="guess-alert guess-alert--bad">{batchError}</div> : null}
          <div className="guess-record-preview">
            <span>合买预览</span>
            <strong>{batchParticipants.length} 人</strong>
            <span>总购买 {formatMoney(batchTotalStake)}</span>
            <span>按总额预估收入 {formatMoney(batchPreviewRecord.income)}</span>
            <span>按总额预估净盈亏 {formatMoney(batchPreviewRecord.netProfit)}</span>
          </div>
        </section>

        <section className="guess-layout guess-layout--home">
          <section className="guess-panel">
            <div className="guess-section-head">
              <div>
                <h2>{editingUserId ? '编辑土块' : '新增土块'}</h2>
                <p>封神榜</p>
              </div>
            </div>
            <form className="guess-user-form" onSubmit={upsertUser}>
              <div className="guess-avatar">
                {userForm.avatarDataUrl ? <img src={userForm.avatarDataUrl} alt="头像预览" /> : <UserRound size={28} />}
              </div>
              <label>
                用户名
                <input value={userForm.name} onChange={(event) => setUserForm({ ...userForm, name: event.target.value })} placeholder="例如：半夜看球人" />
              </label>
              <label className="guess-file-button">
                <Upload size={18} />
                头像
                <input accept="image/*" type="file" onChange={(event) => readAvatar(event, (avatarDataUrl) => setUserForm((current) => ({ ...current, avatarDataUrl })))} />
              </label>
              <button className="guess-primary-button" type="submit">
                {editingUserId ? <Save size={18} /> : <Plus size={18} />}
                {editingUserId ? '保存' : '新增'}
              </button>
              {editingUserId ? (
                <button
                  className="guess-secondary-button"
                  onClick={() => {
                    setEditingUserId(null)
                    setUserForm({ name: '' })
                  }}
                  type="button"
                >
                  <X size={18} />
                  取消
                </button>
              ) : null}
            </form>
            {userError ? <div className="guess-alert guess-alert--bad">{userError}</div> : null}
          </section>

          <section className="guess-panel guess-panel--wide">
            <div className="guess-section-head">
              <div>
                <h2>土块榜</h2>
                <p>可以查找、编辑、删除用户，也可以进入详情维护竞猜记录。</p>
              </div>
              <label className="guess-search">
                查找
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入用户名" />
              </label>
            </div>
            <div className="guess-user-list">
              {filteredUsers.length ? (
                filteredUsers.map((user) => {
                  const stats = statsByUser.get(user.id) ?? computeUserStats(user)
                  return (
                    <article className="guess-user-row" key={user.id}>
                      <div className="guess-avatar">
                        {user.avatarDataUrl ? <img src={user.avatarDataUrl} alt={`${user.name}头像`} /> : <UserRound size={28} />}
                      </div>
                      <div>
                        <strong>{user.name}</strong>
                        <small>{user.records.length} 条竞猜</small>
                      </div>
                      <div>
                        <span className={`guess-rank-badge guess-rank-badge--${stats.rank.path}`}>{stats.rank.label}</span>
                        <small>{stats.score} 分</small>
                      </div>
                      <strong className={stats.totalProfit >= 0 ? 'guess-money-good' : 'guess-money-bad'}>{formatMoney(stats.totalProfit)}</strong>
                      <div className="guess-row-actions">
                        <button className="guess-icon-button" onClick={() => navigate(`/guess-saint/${user.id}`)} title="进入详情" type="button">
                          <Eye size={18} />
                        </button>
                        <button className="guess-icon-button" onClick={() => startEditUser(user)} title="编辑用户" type="button">
                          <Pencil size={18} />
                        </button>
                        <button className="guess-icon-button" onClick={() => deleteUser(user.id)} title="删除用户" type="button">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="guess-empty">
                  <Trophy size={34} />
                  <p>还没有土块，先在左侧立一块名牌。</p>
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  )
}

function StatPill({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`guess-stat-pill ${tone ? `guess-stat-pill--${tone}` : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function RankAxis({ rank }: { rank: RankInfo }) {
  const marker = `${rank.progressPercent}%`
  const positiveWidth = rank.path === 'positive' ? `${rank.progressPercent - 50}%` : '0%'
  const negativeWidth = rank.path === 'negative' ? `${50 - rank.progressPercent}%` : '0%'

  return (
    <div className="guess-rank-axis">
      <div className="guess-rank-axis__labels">
        <span>{NEGATIVE_RANKS[NEGATIVE_RANKS.length - 1]}</span>
        <span>0 分</span>
        <span>{POSITIVE_RANKS[POSITIVE_RANKS.length - 1]}</span>
      </div>
      <div className="guess-rank-axis__track">
        <span className="guess-rank-axis__negative" style={{ width: negativeWidth }} />
        <span className="guess-rank-axis__positive" style={{ width: positiveWidth }} />
        <span className={`guess-rank-axis__marker guess-rank-axis__marker--${rank.path}`} style={{ left: marker }} />
      </div>
      <div className="guess-rank-axis__readout">
        <strong>{rank.label}</strong>
        <span>{rank.score} 分</span>
        <small>{rank.nextLabel}</small>
      </div>
    </div>
  )
}

function formatScore(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function ScoreTrendChart({ points }: { points: ScoreTimelinePoint[] }) {
  if (!points.length) {
    return (
      <div className="guess-empty">
        <Trophy size={34} />
        <p>还没有可绘制的分数记录。</p>
      </div>
    )
  }

  const width = 640
  const height = 220
  const padding = 28
  const chartPoints = [{ id: 'start', date: '起点', label: '起点', score: 0, scoreImpact: 0 }, ...points]
  const rawMin = Math.min(...chartPoints.map((point) => point.score))
  const rawMax = Math.max(...chartPoints.map((point) => point.score))
  const minScore = rawMin === rawMax ? rawMin - 10 : rawMin
  const maxScore = rawMin === rawMax ? rawMax + 10 : rawMax
  const scoreRange = maxScore - minScore || 1
  const innerWidth = width - padding * 2
  const innerHeight = height - padding * 2
  const coords = chartPoints.map((point, index) => ({
    ...point,
    x: padding + (chartPoints.length === 1 ? 0 : (index / (chartPoints.length - 1)) * innerWidth),
    y: padding + ((maxScore - point.score) / scoreRange) * innerHeight,
  }))
  const path = coords.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const zeroY = padding + ((maxScore - 0) / scoreRange) * innerHeight
  const latest = points[points.length - 1]
  const peak = points.reduce((best, point) => (point.score > best.score ? point : best), points[0])
  const valley = points.reduce((best, point) => (point.score < best.score ? point : best), points[0])

  return (
    <div className="guess-score-trend">
      <div className="guess-chart-kpis">
        <StatPill label="当前分" value={formatScore(latest.score)} tone={latest.score >= 0 ? 'good' : 'bad'} />
        <StatPill label="最高点" value={formatScore(peak.score)} tone={peak.score >= 0 ? 'good' : 'bad'} />
        <StatPill label="最低点" value={formatScore(valley.score)} tone={valley.score >= 0 ? 'good' : 'bad'} />
      </div>
      <div className="guess-line-chart-wrap">
        <svg aria-label="分数走势折线图" className="guess-line-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
          <line className="guess-line-chart__axis" x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} />
          <path className="guess-line-chart__area" d={`${path} L ${width - padding} ${zeroY.toFixed(2)} L ${padding} ${zeroY.toFixed(2)} Z`} />
          <path className="guess-line-chart__path" d={path} />
          {coords.map((point, index) => (
            <circle className={index === coords.length - 1 ? 'guess-line-chart__dot guess-line-chart__dot--latest' : 'guess-line-chart__dot'} cx={point.x} cy={point.y} key={point.id} r={index === 0 ? 3.5 : 4.5}>
              <title>{`${point.label} ${point.date}：${formatScore(point.score)}（${formatScore(point.scoreImpact)}）`}</title>
            </circle>
          ))}
        </svg>
        <div className="guess-line-chart__labels">
          <span>起点 0</span>
          <span>{latest.date} {formatScore(latest.score)}</span>
        </div>
      </div>
    </div>
  )
}

function CountryMoneyChart({ stats }: { stats: CountryMoneyStat[] }) {
  const profitStats = [...stats].filter((stat) => stat.profit > 0).sort((left, right) => right.profit - left.profit).slice(0, 5)
  const lossStats = [...stats].filter((stat) => stat.loss < 0).sort((left, right) => left.loss - right.loss).slice(0, 5)
  const maxValue = Math.max(1, ...profitStats.map((stat) => stat.profit), ...lossStats.map((stat) => Math.abs(stat.loss)))

  if (!profitStats.length && !lossStats.length) {
    return (
      <div className="guess-empty">
        <Trophy size={34} />
        <p>还没有国家盈亏记录。</p>
      </div>
    )
  }

  return (
    <div className="guess-country-chart">
      <CountryMoneyList maxValue={maxValue} mode="loss" stats={lossStats} title="亏损最多" />
      <CountryMoneyList maxValue={maxValue} mode="profit" stats={profitStats} title="盈利最多" />
    </div>
  )
}

function CountryMoneyList({
  maxValue,
  mode,
  stats,
  title,
}: {
  maxValue: number
  mode: 'profit' | 'loss'
  stats: CountryMoneyStat[]
  title: string
}) {
  return (
    <div className={`guess-country-list guess-country-list--${mode}`}>
      <div className="guess-country-list__title">
        <span>{title}</span>
        <strong>{stats[0]?.country ?? '暂无'}</strong>
      </div>
      {stats.length ? (
        <div className="guess-country-bars">
          {stats.map((stat) => {
            const value = mode === 'profit' ? stat.profit : stat.loss
            const width = `${Math.max(5, (Math.abs(value) / maxValue) * 100)}%`
            return (
              <div className="guess-country-row" key={`${mode}-${stat.country}`}>
                <div className="guess-country-row__meta">
                  <strong>{stat.country}</strong>
                  <span>{formatMoney(value)} / {stat.recordCount} 注</span>
                </div>
                <div className="guess-country-row__track">
                  <span style={{ width }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="guess-country-empty">暂无</div>
      )}
    </div>
  )
}

function RecordPreview({ record }: { record: ComputedRecord }) {
  return (
    <div className="guess-record-preview">
      <span>预览</span>
      <strong>{record.hitAll ? '全中' : `${record.correctLegs}/${record.legs.length} 命中`}</strong>
      <span>收入 {formatMoney(record.income)}</span>
      <span>净盈亏 {formatMoney(record.netProfit)}</span>
      <span>段位分 {record.scoreImpact > 0 ? '+' : ''}{record.scoreImpact}</span>
      <small>{record.formulaText}</small>
    </div>
  )
}

function RecordsTable({ records, onEdit, onDelete }: { records: ComputedRecord[]; onEdit: (record: ComputedRecord) => void; onDelete: (id: string) => void }) {
  if (!records.length) {
    return (
      <div className="guess-empty">
        <FileJson size={34} />
        <p>还没有竞猜记录。新增一条之后，段位轴会自动开始偏移。</p>
      </div>
    )
  }

  return (
    <div className="guess-table-wrap">
      <table className="guess-record-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>比赛队伍</th>
            <th>猜测结果</th>
            <th>实际结果</th>
            <th>下注</th>
            <th>赔率</th>
            <th>收入</th>
            <th>净盈亏</th>
            <th>段位分</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.date}</td>
              <td>{record.legs.map((leg) => `${leg.homeTeam} vs ${leg.awayTeam}`).join(' / ')}</td>
              <td>{record.predictionText}</td>
              <td>{record.actualText}</td>
              <td>{formatMoney(record.stake)}</td>
              <td>{record.odds.toFixed(2)}</td>
              <td>{formatMoney(record.income)}</td>
              <td className={record.netProfit >= 0 ? 'guess-money-good' : 'guess-money-bad'}>{formatMoney(record.netProfit)}</td>
              <td className={record.scoreImpact >= 0 ? 'guess-money-good' : 'guess-money-bad'}>
                {record.scoreImpact > 0 ? '+' : ''}
                {record.scoreImpact}
              </td>
              <td>
                <div className="guess-row-actions">
                  <button className="guess-icon-button" onClick={() => onEdit(record)} title="编辑记录" type="button">
                    <Pencil size={16} />
                  </button>
                  <button className="guess-icon-button" onClick={() => onDelete(record.id)} title="删除记录" type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RankRules() {
  return (
    <section className="guess-panel">
      <div className="guess-section-head">
        <div>
          <h2>段位法则</h2>
          <p>全错也是一种全对</p>
        </div>
      </div>
      <div className="guess-rules">
        <div>
          <strong>正道段位</strong>
          <p>{POSITIVE_RANKS.join(' → ')}</p>
        </div>
        <div>
          <strong>邪道段位</strong>
          <p>{NEGATIVE_RANKS.join(' → ')}</p>
        </div>
        <ul>
          <li>每 100 分晋升一个大段，每个大段均分一到十段。</li>
          <li>全中加分，失手扣分；过关越多，奖惩越重。</li>
          <li>比分越极端、盈亏越大，段位分波动越明显。</li>
          <li>历史记录越多，新增记录基础倍数越高</li>
        </ul>
      </div>
    </section>
  )
}
