import './bet-ticket.js'

function oddFromBtn(btn) {
  const label = btn.querySelector('bcdk-bet-button-label.btn_label:not(.is-top)')
  if (!label) return null
  const val = parseFloat(label.textContent.replace(/<!---->/g, '').replace(',', '.').trim())
  return val > 1.01 && val < 100 ? val : null
}

function teamNameFromBtn(btn) {
  const label = btn.querySelector('bcdk-bet-button-label.btn_label.is-top')
  if (!label) return null
  return [...label.querySelectorAll('span')].map(s => s.textContent).join('').trim()
}

function scrapeMarketRows(marketEl) {
  const rows = []
  for (const line of marketEl.querySelectorAll('div.marketBox_lineSelection')) {
    const btn = line.querySelector('button[betbuttontype="odd"]')
    if (!btn) continue
    const odd = oddFromBtn(btn)
    if (!odd) continue
    const labelEl = line.querySelector('p.marketBox_label')
    const label = labelEl ? labelEl.textContent.trim() : (teamNameFromBtn(btn) ?? '')
    if (label) rows.push({ label, odd })
  }
  return rows
}

function scrapeLive(header) {
  const timerText = header.querySelector('scoreboards-timer')?.textContent?.trim()
  if (!timerText) return null

  const score1 = header.querySelector('.scoreboard_score.scoreboard_score-1')?.textContent?.trim() ?? '0'
  const score2 = header.querySelector('.scoreboard_score.scoreboard_score-2')?.textContent?.trim() ?? '0'
  const red1El  = header.querySelector('.scoreboard_cards.scoreboard_cards-1 .scoreboard_card.is-red')
  const red2El  = header.querySelector('.scoreboard_cards.scoreboard_cards-2 .scoreboard_card.is-red')

  return {
    timer:    timerText,
    score:    { home: score1, away: score2 },
    redCards: {
      home: red1El ? parseInt(red1El.textContent) : 0,
      away: red2El ? parseInt(red2El.textContent) : 0,
    },
  }
}

function scrape() {
  // Exclure les labels dans la sidebar des matchs live
  const label1El = [...document.querySelectorAll('[data-qa="contestant-1-label"]')]
    .find(el => !el.closest('sports-live-event-bucket'))
  const label2El = [...document.querySelectorAll('[data-qa="contestant-2-label"]')]
    .find(el => !el.closest('sports-live-event-bucket'))
  if (!label1El || !label2El) return null

  const home = label1El.textContent.trim()
  const away = label2El.textContent.trim()

  // Remonter depuis le label pour trouver le header du match courant
  // garantit qu'on reste dans le même conteneur pour le live
  const header = label1El.closest('[sportseventheader]')

  const markets = {}
  for (const marketEl of document.querySelectorAll('sports-markets-single-market.marketElement')) {
    const title = marketEl.querySelector('h2.marketBox_headTitle')?.textContent?.trim()
    if (!title) continue
    const rows = scrapeMarketRows(marketEl)
    if (rows.length) markets[title] = rows
  }

  return { match: `${home} vs ${away}`, home, away, markets, live: header ? scrapeLive(header) : null }
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }

  .widget {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 2147483647;
    width: 320px;
    background: #F4F5F7;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,.15);
    color: #111827;
  }

  /* ── Handle (zone de drag) ── */
  .handle {
    padding: 12px 16px;
    background: linear-gradient(135deg, #E3001B, #B90016);
    border-radius: 12px 12px 0 0;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: grab;
    user-select: none;
    box-shadow: 0 2px 10px rgba(227, 0, 27, 0.2);
  }
  .handle:active  { cursor: grabbing; }
  .widget.collapsed .handle { border-radius: 12px; }

  .handle-icon  { font-size: 20px; flex-shrink: 0; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1)); }
  .handle-title { font-size: 14px; font-weight: 800; color: #FFFFFF; flex: 1; letter-spacing: -0.5px; }

  .ctrl-btn {
    background: none;
    border: none;
    color: #FFFFFF;
    opacity: 0.7;
    cursor: pointer;
    font-size: 16px;
    padding: 2px 6px;
    border-radius: 4px;
    line-height: 1;
    flex-shrink: 0;
    transition: opacity 0.2s ease;
  }
  .ctrl-btn:hover { opacity: 1; background: rgba(255,255,255,0.15); }

  /* ── Corps ── */
  .body { padding: 14px 16px; overflow-y: auto; max-height: 75vh; }
  .widget.collapsed .body { display: none; }

  .match-box {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
    min-height: 48px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
  .match-name { font-size: 13px; font-weight: 800; color: #111827; }
  .match-sub  { font-size: 11px; color: #6B7280; margin-top: 4px; font-weight: 500; }
  .match-none { font-size: 12px; color: #6B7280; font-style: italic; }

  .live-block { margin-top: 8px; padding: 8px 10px; background: #FFF5F5; border: 1px solid #FCA5A5; border-radius: 8px; }
  .live-timer { font-size: 10px; font-weight: 700; color: #E3001B; text-align: center; margin-bottom: 6px; letter-spacing: 0.3px; }
  .live-score-row { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .live-team  { font-size: 11px; font-weight: 700; color: #111827; flex: 1; }
  .live-team.home { text-align: right; }
  .live-team.away { text-align: left; }
  .live-score { font-size: 20px; font-weight: 900; color: #111827; letter-spacing: 2px; }
  .live-red   { display: inline-block; background: #DC2626; color: #fff; font-size: 9px; font-weight: 800; border-radius: 3px; padding: 0px 4px; margin-left: 4px; vertical-align: middle; }
  .live-red.home { margin-left: 4px; }
  .live-red.away { margin-left: 0; margin-right: 4px; }

  .mode-row {
    display: flex; align-items: center;
    justify-content: space-between; margin-bottom: 12px;
    background: #FFFFFF;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid #E5E7EB;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }
  .mode-label  { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; }
  .toggle-wrap { display: flex; background: #F3F4F6; border-radius: 6px; padding: 3px; gap: 3px; }
  .mode-btn {
    padding: 5px 10px; border: none; border-radius: 4px;
    font-size: 10px; font-weight: 700; cursor: pointer;
    background: none; color: #6B7280; transition: all 0.2s ease;
  }
  .mode-btn.active { background: #FFFFFF; color: #E3001B; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

  .analyze-btn {
    width: 100%; padding: 12px; background: linear-gradient(135deg, #E3001B, #CC0016);
    border: none; border-radius: 24px;
    font-size: 13px; font-weight: 800; color: #FFFFFF; cursor: pointer;
    box-shadow: 0 4px 12px rgba(227, 0, 27, 0.25);
    transition: all 0.2s ease; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .analyze-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(227, 0, 27, 0.35); }
  .analyze-btn:disabled { background: #D1D5DB; color: #9CA3AF; box-shadow: none; cursor: not-allowed; }

  .error-box {
    margin-top: 10px; padding: 10px 12px;
    background: #FEF2F2; border: 1px solid #FCA5A5;
    border-left: 4px solid #EF4444; border-radius: 8px; font-size: 11px; font-weight: 500; color: #B91C1C;
  }

  .loading-row {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    margin-top: 12px; font-size: 11px; font-weight: 600; color: #6B7280; padding: 8px;
  }
  .spinner {
    width: 16px; height: 16px;
    border: 2px solid #E5E7EB; border-top-color: #E3001B;
    border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0;
  }

  .tickets { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }

  @keyframes spin { to { transform: rotate(360deg); } }
`

function mk(tag, cls) {
  const el = document.createElement(tag)
  if (cls) el.className = cls
  return el
}

class BetclicWidget {
  constructor(shadow) {
    this._shadow = shadow
    this._mode = 'normal'
    this._scrapedData = null
    this._collapsed = false
    // Drag state
    this._dragging = false
    this._ox = 0
    this._oy = 0
    this._build()
  }

  _build() {
    const style = document.createElement('style')
    style.textContent = STYLES
    this._shadow.appendChild(style)

    this._widget = mk('div', 'widget')

    // ── Handle ──────────────────────────────────────────────────────────────
    const handle = mk('div', 'handle')
    const icon   = mk('span', 'handle-icon');  icon.textContent = '⚽'
    const title  = mk('span', 'handle-title'); title.textContent = 'Betclic AI'
    this._collapseBtn = mk('button', 'ctrl-btn')
    this._collapseBtn.textContent = '─'
    this._collapseBtn.title = 'Réduire'
    handle.append(icon, title, this._collapseBtn)

    // ── Body ────────────────────────────────────────────────────────────────
    const body = this._body = mk('div', 'body')

    // Match info
    const matchBox    = mk('div', 'match-box')
    this._matchNone   = mk('div', 'match-none');  this._matchNone.textContent = 'Aucun match détecté…'
    this._matchName   = mk('div', 'match-name')
    this._matchSub    = mk('div', 'match-sub')
    this._matchLive   = mk('div', 'live-block')
    this._matchLive.style.display = 'none'
    const matchInfo   = mk('div');                matchInfo.append(this._matchName, this._matchSub, this._matchLive)
    this._matchInfo   = matchInfo
    matchInfo.style.display = 'none'
    matchBox.append(this._matchNone, matchInfo)

    // Mode toggle
    const modeRow    = mk('div', 'mode-row')
    const modeLabel  = mk('span', 'mode-label'); modeLabel.textContent = 'Mode'
    const modeWrap   = mk('div', 'toggle-wrap')
    this._btnNormal  = mk('button', 'mode-btn active'); this._btnNormal.textContent = 'Normal'
    this._btnAggr    = mk('button', 'mode-btn');        this._btnAggr.textContent = 'Agressif'
    modeWrap.append(this._btnNormal, this._btnAggr)
    modeRow.append(modeLabel, modeWrap)

    // Analyze
    this._analyzeBtn = mk('button', 'analyze-btn')
    this._analyzeBtn.textContent = 'Analyser ce match'
    this._analyzeBtn.disabled = true

    // Error
    this._errorBox = mk('div', 'error-box')
    this._errorBox.style.display = 'none'

    // Loading
    this._loadingRow = mk('div', 'loading-row')
    this._loadingRow.innerHTML = '<div class="spinner"></div><span>Analyse en cours…</span>'
    this._loadingRow.style.display = 'none'

    // Tickets
    this._tickets = mk('div', 'tickets')

    body.append(matchBox, modeRow, this._analyzeBtn, this._errorBox, this._loadingRow, this._tickets)
    this._widget.append(handle, body)
    this._shadow.appendChild(this._widget)

    this._bindEvents(handle)
  }

  _bindEvents(handle) {
    // ── Drag ──────────────────────────────────────────────────────────────────
    handle.addEventListener('mousedown', e => {
      if (e.target === this._collapseBtn) return
      this._dragging = true
      const r = this._widget.getBoundingClientRect()
      this._ox = e.clientX - r.left
      this._oy = e.clientY - r.top
      e.preventDefault()
    })
    document.addEventListener('mousemove', e => {
      if (!this._dragging) return
      this._widget.style.right  = 'auto'
      this._widget.style.bottom = 'auto'
      this._widget.style.left = Math.max(0, Math.min(e.clientX - this._ox, window.innerWidth  - this._widget.offsetWidth))  + 'px'
      this._widget.style.top  = Math.max(0, Math.min(e.clientY - this._oy, window.innerHeight - this._widget.offsetHeight)) + 'px'
    })
    document.addEventListener('mouseup', () => { this._dragging = false })

    // ── Collapse ──────────────────────────────────────────────────────────────
    this._collapseBtn.addEventListener('click', () => {
      this._collapsed = !this._collapsed
      this._widget.classList.toggle('collapsed', this._collapsed)
      this._collapseBtn.textContent = this._collapsed ? '+' : '─'
      this._collapseBtn.title = this._collapsed ? 'Agrandir' : 'Réduire'
    })

    // ── Mode ──────────────────────────────────────────────────────────────────
    this._btnNormal.addEventListener('click', () => {
      this._mode = 'normal'
      this._btnNormal.classList.add('active')
      this._btnAggr.classList.remove('active')
    })
    this._btnAggr.addEventListener('click', () => {
      this._mode = 'aggressive'
      this._btnAggr.classList.add('active')
      this._btnNormal.classList.remove('active')
    })

    // ── Analyze ───────────────────────────────────────────────────────────────
    this._analyzeBtn.addEventListener('click', () => this._analyze())
  }

  // ── API publique ─────────────────────────────────────────────────────────────

  setMatch(data) {
    this._scrapedData             = data
    this._matchNone.style.display = 'none'
    this._matchInfo.style.display = 'block'
    this._matchName.textContent   = data.match
    const n = Object.keys(data.markets ?? {}).length
    this._matchSub.textContent = `${n} marché${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}`
    this._analyzeBtn.disabled = false
    this._renderLive(data.live, data.home, data.away)
  }

  _renderLive(live, home, away) {
    if (!live) { this._matchLive.style.display = 'none'; return }

    const redTag = (n, cls) => n > 0 ? `<span class="live-red ${cls}">${n}</span>` : ''

    this._matchLive.innerHTML = `
      <div class="live-timer">${live.timer}</div>
      <div class="live-score-row">
        <span class="live-team home">${home}${redTag(live.redCards.home, 'home')}</span>
        <span class="live-score">${live.score.home} - ${live.score.away}</span>
        <span class="live-team away">${redTag(live.redCards.away, 'away')}${away}</span>
      </div>
    `
    this._matchLive.style.display = 'block'
  }

  clearMatch() {
    this._scrapedData             = null
    this._matchNone.style.display = 'block'
    this._matchInfo.style.display = 'none'
    this._analyzeBtn.disabled     = true
    this._tickets.innerHTML       = ''
    this._setError(null)
  }

  // ── Privé ────────────────────────────────────────────────────────────────────

  _analyze() {
    if (!this._scrapedData) return
    this._setLoading(true)
    this._setError(null)
    this._tickets.innerHTML = ''

    chrome.runtime.sendMessage(
      { type: 'ANALYZE', data: this._scrapedData, mode: this._mode },
      res => {
        this._setLoading(false)
        if (!res?.ok)             { this._setError(res?.error ?? 'Erreur inconnue'); return }
        if (!res.tickets?.length) {
          const preview = res.raw ? res.raw.slice(0, 200).replace(/\n/g, ' ') : '(vide)'
          this._setError(`Aucun ticket parsé. Réponse LLM : ${preview}`)
          return
        }
        this._renderTickets(res.tickets)
      }
    )
  }

  _setLoading(on) {
    this._analyzeBtn.disabled        = on
    this._loadingRow.style.display   = on ? 'flex' : 'none'
  }

  _setError(msg) {
    this._errorBox.textContent     = msg ? '⚠ ' + msg : ''
    this._errorBox.style.display   = msg ? 'block' : 'none'
  }

  // Rendu des tickets : Web Component <bet-ticket> si disponible, DOM pur sinon
  _renderTickets(tickets) {
    this._tickets.innerHTML = ''
    const wcAvailable = typeof customElements !== 'undefined' && customElements?.get?.('bet-ticket')
    for (const t of tickets) {
      this._tickets.appendChild(
        wcAvailable ? this._renderWC(t) : this._renderDOM(t)
      )
    }
  }

  _renderWC(t) {
    const el = document.createElement('bet-ticket')
    el.setAttribute('level', t.level)
    el.setAttribute('odd', String(t.odd))
    const bets = t.bets.map((text, i) => ({ text, odd: t.selOdds?.[i] ?? null }))
    el.setAttribute('bets', JSON.stringify(bets))
    return el
  }

  _renderDOM(t) {
    const PLAN_COLORS = ['#3b82f6', '#8b5cf6', '#E3001B']
    const planIdx = parseInt(t.level.replace(/\D/g, '')) - 1
    const color   = PLAN_COLORS[planIdx] ?? '#475569'
    const odd     = isNaN(t.odd) ? '×?' : `×${t.odd.toFixed(2)}`
    const warn    = t.outOfRange

    const card = mk('div')
    card.style.cssText = `border-radius:12px;padding:12px 14px;background:#FFFFFF;border:1px solid ${warn ? 'rgba(239,68,68,.3)' : 'rgba(0,0,0,.06)'};border-left:4px solid ${warn ? '#ef4444' : color};box-shadow:0 2px 8px rgba(0,0,0,0.04);`

    const header = mk('div')
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #F3F4F6;'

    const lvl = mk('span')
    lvl.style.cssText = `font-size:12px;font-weight:800;color:${color};`
    lvl.textContent = t.level

    const right = mk('div')
    right.style.cssText = 'display:flex;align-items:center;gap:6px;'

    if (warn) {
      const warnEl = mk('span')
      warnEl.style.cssText = 'font-size:10px;color:#ef4444;font-weight:700;'
      warnEl.textContent = '⚠ cote > 7'
      right.appendChild(warnEl)
    }

    const oddEl = mk('span')
    oddEl.style.cssText = `font-size:16px;font-weight:900;color:#111827;background:${warn ? 'rgba(239,68,68,.08)' : '#F3F4F6'};padding:4px 10px;border-radius:16px;`
    oddEl.textContent = odd
    right.appendChild(oddEl)
    header.append(lvl, right)

    const bets = mk('div')
    bets.style.cssText = 'display:flex;flex-direction:column;gap:6px;'
    for (let i = 0; i < t.bets.length; i++) {
      const row = mk('div')
      row.style.cssText = 'font-size:12px;color:#374151;font-weight:500;display:flex;align-items:flex-start;gap:6px;'
      const dot = mk('span')
      dot.style.cssText = 'width:5px;height:5px;border-radius:50%;background:#D1D5DB;margin-top:6px;flex-shrink:0;'
      const txt = mk('span')
      txt.textContent = t.bets[i]
      const sel = t.selOdds?.[i]
      if (sel != null) {
        const s = mk('span')
        s.style.cssText = 'color:#6B7280;font-size:11px;font-weight:700;margin-left:4px;'
        s.textContent = `(${sel.toFixed(2)})`
        txt.appendChild(s)
      }
      row.append(dot, txt)
      bets.appendChild(row)
    }
    card.append(header, bets)
    return card
  }
}

function mount() {
  if (document.getElementById('betclic-ai-host')) return

  const host = document.createElement('div')
  host.id = 'betclic-ai-host'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const widget = new BetclicWidget(shadow)

  // Scrape initial
  const initial = scrape()
  if (initial) widget.setMatch(initial)

  // Surveille les changements de page (SPA) et de DOM (cotes chargées en lazy)
  let scanTimer = null
  let lastUrl   = location.href
  let lastMatch = initial?.match ?? null

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl   = location.href
      lastMatch = null
      widget.clearMatch()
    }
    clearTimeout(scanTimer)
    scanTimer = setTimeout(() => {
      const data = scrape()
      if (!data) return
      if (data.match !== lastMatch) {
        lastMatch = data.match
        widget.setMatch(data)
      } else {
        // Match déjà affiché : refresh uniquement les données live
        widget._renderLive(data.live, data.home, data.away)
      }
    }, 800)
  }).observe(document.body, { childList: true, subtree: true })
}

mount()

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'SCRAPE_ODDS') return false
  const data = scrape()
  sendResponse({ ok: !!data, data })
  return false
})
