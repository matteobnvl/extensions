// ─── Background bridge ────────────────────────────────────────────────────────

function bgFetch(path, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'FLASHSCORE', path, params }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message))
      if (res?.ok) return resolve(res.data)
      reject(new Error(res?.error ?? 'Unknown API error'))
    })
  })
}

// ─── Probability helpers ──────────────────────────────────────────────────────

function normalizeOdds(homeOdd, drawOdd, awayOdd) {
  const hi = 1 / homeOdd
  const di = drawOdd ? 1 / drawOdd : 0
  const ai = 1 / awayOdd
  const sum = hi + di + ai
  return { home: hi / sum, draw: di ? di / sum : null, away: ai / sum }
}

function valueScore(hist, fair) {
  if (hist == null || !fair) return null
  return hist / fair
}

function valueLabel(score) {
  if (score == null) return 'unknown'
  if (score >= 1.1)  return 'value'
  if (score >= 0.9)  return 'neutral'
  return 'bad'
}

function pct(p) {
  return p != null ? Math.round(p * 100) + '%' : '--'
}

function vsLabel(score) {
  if (score == null) return ''
  const p = Math.round((score - 1) * 100)
  return p >= 0 ? `+${p}% val.` : `${p}% val.`
}

// ─── Site scrapers ────────────────────────────────────────────────────────────

function extractOdds(el) {
  return [...el.querySelectorAll('button, [class*="odd"], [class*="cote"], [class*="bet"]')]
    .map(b => parseFloat(b.textContent.replace(',', '.').trim()))
    .filter(n => n > 1.01 && n < 50)
}

function extractOddsBetclic(container) {
  const btnEls = [...container.querySelectorAll('[betbuttontype="odd"]')]
  if (!btnEls.length) return extractOdds(container)
  return btnEls
    .map(btn => {
      const label = btn.querySelector('bcdk-bet-button-label:not(.is-top)')
      return label ? parseFloat(label.textContent.replace(',', '.').trim()) : NaN
    })
    .filter(n => n > 1.01 && n < 50)
}

function getBetclicTeamName(btn) {
  const label = btn.querySelector('bcdk-bet-button-label.is-top')
  if (!label) return ''
  return [...label.querySelectorAll('span')].map(s => s.textContent).join('').trim()
}

// Trouve le meilleur triplet 1/N/2 : marge bookmaker typique 3-12%
function findMainMarketOdds(oddsRaw) {
  for (let i = 0; i <= oddsRaw.length - 3; i++) {
    const [a, b, c] = [oddsRaw[i], oddsRaw[i + 1], oddsRaw[i + 2]]
    const margin = 1 / a + 1 / b + 1 / c
    if (margin >= 1.03 && margin <= 1.12) return [a, b, c]
  }
  // fallback : premier triplet avec marge < 1.25
  for (let i = 0; i <= oddsRaw.length - 3; i++) {
    const [a, b, c] = [oddsRaw[i], oddsRaw[i + 1], oddsRaw[i + 2]]
    const margin = 1 / a + 1 / b + 1 / c
    if (margin >= 1.01 && margin <= 1.25) return [a, b, c]
  }
  return oddsRaw.slice(0, 3)
}

function buildMatch(home, away, oddsRaw) {
  if (!home || !away) return null
  const [homeOdd, drawOdd, awayOdd] = oddsRaw.length >= 3
    ? [oddsRaw[0], oddsRaw[1], oddsRaw[2]]
    : oddsRaw.length === 2
    ? [oddsRaw[0], null, oddsRaw[1]]
    : [null, null, null]
  return { id: `${home}__${away}`, home, away, odds: { home: homeOdd, draw: drawOdd, away: awayOdd } }
}

function scrapeBetclic() {
  const matches = []

  // ── Scoreboard / page match detail ───────────────────────────────────────────
  const label1 = document.querySelector('[data-qa="contestant-1-label"]')
  const label2 = document.querySelector('[data-qa="contestant-2-label"]')

  console.log('[BetAnalyzer] contestant labels:', label1?.textContent, '/', label2?.textContent)

  if (label1 && label2) {
    const home = label1.textContent.trim()
    const away = label2.textContent.trim()
    const oddsRaw = extractOddsBetclic(document.body)
    const bestOdds = findMainMarketOdds(oddsRaw)
    console.log('[BetAnalyzer] odds raw (first 5):', oddsRaw.slice(0, 5), '→ best triplet:', bestOdds)
    const m = buildMatch(home, away, bestOdds)
    if (m) return [m]
  }

  // ── Groupes de boutons BCDK (page liste de paris) ────────────────────────────
  const betBtns = [...document.querySelectorAll('[betbuttontype="odd"]')]
  if (betBtns.length >= 2) {
    const groups = new Map()
    for (const btn of betBtns) {
      const container = btn.closest('[class*="event"],[class*="coupon"],[class*="sport"],[class*="match"],[class*="bet-offer"]') ?? btn.parentElement?.parentElement
      if (!container) continue
      if (!groups.has(container)) groups.set(container, [])
      groups.get(container).push(btn)
    }
    for (const [, btns] of groups) {
      if (btns.length < 2) continue
      const names = btns.map(getBetclicTeamName).filter(Boolean)
      if (names.length < 2) continue
      const home = names[0]
      const away = names[names.length - 1]
      const oddsRaw = btns
        .map(btn => {
          const label = btn.querySelector('bcdk-bet-button-label:not(.is-top)')
          return label ? parseFloat(label.textContent.replace(',', '.').trim()) : NaN
        })
        .filter(n => n > 1.01 && n < 50)
      const m = buildMatch(home, away, oddsRaw)
      if (m) matches.push(m)
    }
    if (matches.length) return matches
  }

  // ── Coupon list fallback ──────────────────────────────────────────────────────
  const sel = ['[class*="coupon-event"]','[class*="eventCoupon"]','[class*="sport-event"]',
    '[data-testid*="event"]','[class*="EventRow"]','[class*="event-row"]',
    '[class*="contestant"]'].join(',')
  const els = document.querySelectorAll(sel)
  console.log('[BetAnalyzer] coupon list elements found:', els.length)
  for (const el of els) {
    const tEls = el.querySelectorAll('[class*="team-name"],[class*="teamName"],[class*="participant"],[class*="Participant"],[class*="contestantLabel"]')
    if (tEls.length < 2) continue
    const m = buildMatch(tEls[0]?.textContent?.trim(), tEls[1]?.textContent?.trim(), extractOddsBetclic(el))
    if (m) matches.push(m)
  }
  return matches
}

function scrapeWinamax() {
  const sel = ['[class*="event-row"]','[class*="EventRow"]','[class*="match-row"]','[class*="sport-event"]'].join(',')
  const matches = []
  for (const el of document.querySelectorAll(sel)) {
    const tEls = el.querySelectorAll('[class*="team"],[class*="participant"],[class*="Team"]')
    if (tEls.length < 2) continue
    const m = buildMatch(tEls[0]?.textContent?.trim(), tEls[1]?.textContent?.trim(), extractOdds(el))
    if (m) matches.push(m)
  }
  return matches
}

const SCRAPERS = {
  'betclic.fr': scrapeBetclic, 'betclic.com': scrapeBetclic,
  'winamax.fr': scrapeWinamax, 'unibet.fr': scrapeBetclic, 'pmu.fr': scrapeBetclic,
}

function getScraper() {
  return SCRAPERS[location.hostname.replace(/^www\./, '')] ?? null
}

// ─── FlashScore fetching ──────────────────────────────────────────────────────

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function bgFetchWithRetry(path, params, retries = 2, delay = 1500) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await bgFetch(path, params)
    } catch (err) {
      const is429 = err.message.includes('429')
      if (is429 && i < retries) {
        console.warn(`[BetAnalyzer] 429 rate limit, retry ${i + 1}/${retries} in ${delay}ms`)
        await sleep(delay)
        delay *= 2
      } else {
        throw err
      }
    }
  }
}

async function fetchTeamWinRate(teamName) {
  const search = await bgFetchWithRetry('/v1/search/multi-search', { q: teamName, sport: 'FOOTBALL' })
  const team = search?.teams?.[0] ?? search?.results?.find(r => r.type === 'team')
  if (!team?.id) return null

  await sleep(300) // petite pause entre les deux appels
  const statsRes = await bgFetchWithRetry('/v1/teams/get-statistics', { teamId: team.id, sport: 'FOOTBALL', type: 'overall' })
  const s = statsRes?.statistics ?? statsRes?.data ?? statsRes
  if (!s) return null

  const played = s.played ?? s.matches ?? s.gamesPlayed ?? 0
  if (!played) return null

  return {
    winRate:  (s.wins  ?? s.win  ?? 0) / played,
    drawRate: (s.draws ?? s.draw ?? 0) / played,
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }

  .panel {
    position: fixed; top: 50%; right: 0;
    transform: translateY(-50%);
    z-index: 2147483647;
    display: flex; align-items: flex-start;
  }

  .tab {
    background: #0f172a; border: 1px solid #1e3a5f;
    border-right: none; border-radius: 10px 0 0 10px;
    padding: 14px 8px; cursor: pointer;
    writing-mode: vertical-rl; font-size: 10px; font-weight: 700;
    color: #60a5fa; letter-spacing: 1px;
    user-select: none; display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .tab:hover { background: #162033; }

  .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
  .dot.loading { background: #f59e0b; animation: pulse 1s ease-in-out infinite; }
  .dot.empty   { background: #475569; }

  .content {
    width: 320px; max-height: 75vh;
    background: #0f172a; border: 1px solid #1e3a5f;
    border-right: none; border-radius: 12px 0 0 12px;
    display: flex; flex-direction: column; overflow: hidden; color: #cbd5e1;
  }
  .content.hidden { display: none; }

  .header { padding: 12px 14px; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .header-title { font-size: 14px; font-weight: 700; color: #f1f5f9; }
  .header-sub { font-size: 10px; color: #475569; margin-top: 3px; }
  .badge { background: #1e3a5f; color: #60a5fa; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }

  .list { overflow-y: auto; flex: 1; }

  .card { padding: 11px 14px; border-bottom: 1px solid #1e293b; }
  .card:last-child { border-bottom: none; }

  .teams { font-size: 12px; font-weight: 600; color: #f1f5f9; margin-bottom: 8px; display: flex; align-items: center; gap: 5px; }
  .teams span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vs { color: #334155; font-size: 10px; font-weight: 400; flex-shrink: 0; }

  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-bottom: 6px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr;     gap: 4px; margin-bottom: 6px; }

  .odd-cell  { background: #1e293b; border-radius: 6px; padding: 5px 4px; text-align: center; }
  .cell-label { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .cell-value { font-size: 13px; font-weight: 700; color: #f1f5f9; }

  .prob-cell         { border-radius: 6px; padding: 5px 4px; text-align: center; }
  .prob-cell.value   { background: rgba(34,197,94,.12); border: 1px solid rgba(34,197,94,.25); }
  .prob-cell.neutral { background: rgba(234,179,8,.08);  border: 1px solid rgba(234,179,8,.2); }
  .prob-cell.bad     { background: rgba(239,68,68,.1);   border: 1px solid rgba(239,68,68,.2); }
  .prob-cell.unknown { background: #1e293b; border: 1px solid transparent; }

  .prob-pct { font-size: 12px; font-weight: 700; }
  .value   .prob-pct { color: #22c55e; }
  .neutral .prob-pct { color: #eab308; }
  .bad     .prob-pct { color: #ef4444; }
  .unknown .prob-pct { color: #475569; }

  .prob-vs { font-size: 9px; margin-top: 1px; }
  .value   .prob-vs { color: #16a34a; }
  .neutral .prob-vs { color: #ca8a04; }
  .bad     .prob-vs { color: #b91c1c; }
  .unknown .prob-vs { color: #334155; }

  .empty { padding: 28px 16px; text-align: center; color: #334155; }
  .empty-icon { font-size: 28px; margin-bottom: 8px; }
  .empty p { font-size: 11px; line-height: 1.6; }

  .loading-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #475569; padding-top: 4px; }
  .spinner { width: 10px; height: 10px; border: 2px solid #1e293b; border-top-color: #60a5fa; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
  .error-row { font-size: 10px; color: #ef4444; padding-top: 4px; }

  .footer { padding: 7px 14px; border-top: 1px solid #1e293b; font-size: 9px; color: #1e3a5f; display: flex; justify-content: space-between; flex-shrink: 0; }

  @keyframes spin  { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
`

// ─── UI builder (no eval, pure DOM) ──────────────────────────────────────────

function mk(tag, cls, extra = {}) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  Object.assign(el, extra)
  return el
}

class BetAnalyzerUI {
  constructor(shadow) {
    this._shadow = shadow
    this._matches = []   // { id, home, away, odds, loading, error, probs, _card }
    this._expanded = true
    this._build()
  }

  _build() {
    const panel = mk('div', 'panel')

    // Tab
    this._dot = mk('span', 'dot')
    const tabLabel = mk('span')
    tabLabel.innerHTML = 'BET<br>ANA<br>LYZER'
    const tab = mk('div', 'tab')
    tab.append(this._dot, tabLabel)
    tab.addEventListener('click', () => this._toggle())

    // Content
    this._content = mk('div', 'content')

    // Header
    this._sub   = mk('div', 'header-sub')
    this._badge = mk('span', 'badge')
    const titleDiv = mk('div', 'header-title')
    titleDiv.textContent = '📊 BetAnalyzer'
    const headerLeft = mk('div')
    headerLeft.append(titleDiv, this._sub)
    const header = mk('div', 'header')
    header.append(headerLeft, this._badge)

    // List
    this._list = mk('div', 'list')
    this._empty = mk('div', 'empty')
    this._empty.innerHTML = '<div class="empty-icon">🔍</div><p>Aucun match détecté.<br>Naviguez vers une page de cotes.</p>'
    this._list.appendChild(this._empty)

    // Footer
    const footer = mk('div', 'footer')
    footer.innerHTML = '<span>Flashscore · RapidAPI</span><span>Shadow DOM · Vanilla JS</span>'

    this._content.append(header, this._list, footer)
    panel.append(tab, this._content)
    this._shadow.appendChild(panel)
    this._syncHeader()
  }

  _toggle() {
    this._expanded = !this._expanded
    this._content.classList.toggle('hidden', !this._expanded)
  }

  _syncHeader() {
    const n = this._matches.length
    this._sub.textContent = `${n} match(s) détecté(s)`
    this._badge.textContent = String(n)
    this._empty.style.display = n === 0 ? 'block' : 'none'
    const loading = this._matches.some(m => m.loading)
    this._dot.className = 'dot' + (loading ? ' loading' : n === 0 ? ' empty' : '')
  }

  addMatch(match) {
    this._matches.push(match)
    match._card = this._buildCard(match)
    this._list.appendChild(match._card)
    this._syncHeader()
  }

  refreshMatch(match) {
    if (!match._card) return
    const card = match._card
    const { probsEl, loadingEl, errorEl } = card._ui

    loadingEl.style.display = match.loading ? 'flex' : 'none'
    errorEl.style.display   = (!match.loading && match.error) ? 'block' : 'none'

    probsEl.innerHTML = ''
    if (!match.loading && !match.error && match.probs) {
      probsEl.appendChild(this._buildProbsGrid(match))
    }
    this._syncHeader()
  }

  _buildCard(match) {
    const card = mk('div', 'card')

    const teams = mk('div', 'teams')
    const home = mk('span'); home.textContent = match.home
    const vs   = mk('span', 'vs'); vs.textContent = 'VS'
    const away = mk('span'); away.textContent = match.away
    teams.append(home, vs, away)

    card.appendChild(teams)
    card.appendChild(this._buildOddsGrid(match))

    const probsEl   = mk('div')
    const loadingEl = mk('div', 'loading-row')
    loadingEl.innerHTML = '<div class="spinner"></div><span>Chargement des stats Flashscore...</span>'
    const errorEl = mk('div', 'error-row')
    errorEl.style.display = 'none'
    errorEl.textContent = '⚠ Données non disponibles pour ce match'

    card.append(probsEl, loadingEl, errorEl)
    card._ui = { probsEl, loadingEl, errorEl }
    return card
  }

  _buildOddsGrid(match) {
    const cols = match.odds.draw ? 3 : 2
    const grid = mk('div', `grid-${cols}`)
    const defs = [
      { label: '1 Domicile', val: match.odds.home.toFixed(2) },
      ...(match.odds.draw ? [{ label: 'N Nul', val: match.odds.draw.toFixed(2) }] : []),
      { label: '2 Extérieur', val: match.odds.away.toFixed(2) },
    ]
    for (const { label, val } of defs) {
      const cell = mk('div', 'odd-cell')
      const l = mk('div', 'cell-label'); l.textContent = label
      const v = mk('div', 'cell-value'); v.textContent = val
      cell.append(l, v)
      grid.appendChild(cell)
    }
    return grid
  }

  _buildProbsGrid(match) {
    const { probs, odds } = match
    const cols = odds.draw ? 3 : 2
    const grid = mk('div', `grid-${cols}`)
    const defs = [
      { label: 'Hist. Dom.', prob: probs.homeWin,  score: probs.homeScore, cls: probs.homeLabel },
      ...(odds.draw ? [{ label: 'Hist. Nul', prob: probs.drawRate, score: probs.drawScore, cls: probs.drawLabel }] : []),
      { label: 'Hist. Ext.', prob: probs.awayWin,  score: probs.awayScore, cls: probs.awayLabel },
    ]
    for (const { label, prob, score, cls } of defs) {
      const cell = mk('div', `prob-cell ${cls ?? 'unknown'}`)
      const l  = mk('div', 'cell-label'); l.textContent  = label
      const p  = mk('div', 'prob-pct');   p.textContent  = pct(prob)
      const vs = mk('div', 'prob-vs');    vs.textContent = vsLabel(score)
      cell.append(l, p, vs)
      grid.appendChild(cell)
    }
    return grid
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────

class BetAnalyzer {
  constructor(ui) {
    this._ui = ui
    this._seen = new Set()
    this._scanTimer = null
  }

  start() {
    this._scan()
    let lastUrl = location.href
    new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        this._seen.clear()
      }
      clearTimeout(this._scanTimer)
      this._scanTimer = setTimeout(() => this._scan(), 800)
    }).observe(document.body, { childList: true, subtree: true })
  }

  _scan() {
    const scraper = getScraper()
    if (!scraper) return
    for (const match of scraper()) {
      if (this._seen.has(match.id)) continue
      this._seen.add(match.id)
      match.loading = true
      match.error   = false
      match.probs   = null
      this._ui.addMatch(match)
      this._enrich(match)
    }
  }

  async _enrich(match) {
    try {
      const [homeData, awayData] = await Promise.all([
        fetchTeamWinRate(match.home),
        fetchTeamWinRate(match.away),
      ])

      if (!homeData && !awayData) { match.error = true; return }

      const fair = normalizeOdds(match.odds.home, match.odds.draw ?? 10, match.odds.away)

      const homeWin  = homeData?.winRate  ?? null
      const drawRate = homeData?.drawRate ?? null
      const awayWin  = awayData?.winRate  ?? null

      const homeScore = valueScore(homeWin,  fair.home)
      const drawScore = valueScore(drawRate, fair.draw)
      const awayScore = valueScore(awayWin,  fair.away)

      match.probs = {
        homeWin, drawRate, awayWin,
        homeScore, drawScore, awayScore,
        homeLabel: valueLabel(homeScore),
        drawLabel: valueLabel(drawScore),
        awayLabel: valueLabel(awayScore),
      }
    } catch (err) {
      console.warn('[BetAnalyzer] enrich failed:', err.message)
      match.error = true
    } finally {
      match.loading = false
      this._ui.refreshMatch(match)
    }
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

function mount() {
  if (document.getElementById('bet-analyzer-host')) return

  console.log('[BetAnalyzer] Mounting on', location.hostname)

  const host = document.createElement('div')
  host.id = 'bet-analyzer-host'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = STYLES
  shadow.appendChild(style)

  const ui = new BetAnalyzerUI(shadow)
  new BetAnalyzer(ui).start()

  console.log('[BetAnalyzer] Ready')
}

mount()
