import './bet-ticket.js'

// ─── Scraper ──────────────────────────────────────────────────────────────────

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

function scrape() {
  const home = document.querySelector('[data-qa="contestant-1-label"]')?.textContent?.trim()
  const away = document.querySelector('[data-qa="contestant-2-label"]')?.textContent?.trim()
  if (!home || !away) return null
  const markets = {}
  for (const marketEl of document.querySelectorAll('sports-markets-single-market.marketElement')) {
    const title = marketEl.querySelector('h2.marketBox_headTitle')?.textContent?.trim()
    if (!title) continue
    const rows = scrapeMarketRows(marketEl)
    if (rows.length) markets[title] = rows
  }
  return { match: `${home} vs ${away}`, home, away, markets }
}

// ─── Styles du widget ─────────────────────────────────────────────────────────

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :host { all: initial; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

  .widget {
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 2147483647;
    width: 320px;
    background: #0f172a;
    border: 1px solid #1e3a5f;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,.55);
    color: #cbd5e1;
  }

  /* ── Handle (zone de drag) ── */
  .handle {
    padding: 10px 12px;
    background: #1e293b;
    border-radius: 12px 12px 0 0;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: grab;
    border-bottom: 1px solid #1e3a5f;
    user-select: none;
  }
  .handle:active  { cursor: grabbing; }
  .widget.collapsed .handle { border-radius: 12px; border-bottom: none; }

  .handle-icon  { font-size: 18px; flex-shrink: 0; }
  .handle-title { font-size: 13px; font-weight: 700; color: #f1f5f9; flex: 1; }

  .ctrl-btn {
    background: none;
    border: none;
    color: #475569;
    cursor: pointer;
    font-size: 13px;
    padding: 2px 7px;
    border-radius: 4px;
    line-height: 1;
    flex-shrink: 0;
  }
  .ctrl-btn:hover { background: #334155; color: #94a3b8; }

  /* ── Corps ── */
  .body { padding: 12px 14px; overflow-y: auto; max-height: 75vh; }
  .widget.collapsed .body { display: none; }

  .match-box {
    background: #1e293b;
    border: 1px solid #1e3a5f;
    border-radius: 8px;
    padding: 9px 11px;
    margin-bottom: 10px;
    min-height: 44px;
  }
  .match-name { font-size: 12px; font-weight: 700; color: #f1f5f9; }
  .match-sub  { font-size: 10px; color: #64748b; margin-top: 3px; }
  .match-none { font-size: 11px; color: #475569; font-style: italic; }

  .mode-row {
    display: flex; align-items: center;
    justify-content: space-between; margin-bottom: 10px;
  }
  .mode-label  { font-size: 11px; color: #64748b; }
  .toggle-wrap { display: flex; background: #1e293b; border-radius: 6px; padding: 2px; gap: 2px; }
  .mode-btn {
    padding: 4px 10px; border: none; border-radius: 4px;
    font-size: 10px; font-weight: 600; cursor: pointer;
    background: none; color: #475569;
  }
  .mode-btn.active { background: #1e3a5f; color: #60a5fa; }

  .analyze-btn {
    width: 100%; padding: 9px; background: #1d4ed8;
    border: none; border-radius: 8px;
    font-size: 11px; font-weight: 700; color: #fff; cursor: pointer;
  }
  .analyze-btn:hover:not(:disabled) { background: #2563eb; }
  .analyze-btn:disabled { opacity: 0.45; cursor: default; }

  .error-box {
    margin-top: 8px; padding: 8px 10px;
    background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25);
    border-radius: 6px; font-size: 10px; color: #f87171;
  }

  .loading-row {
    display: flex; align-items: center; gap: 6px;
    margin-top: 10px; font-size: 10px; color: #64748b;
  }
  .spinner {
    width: 12px; height: 12px;
    border: 2px solid #1e293b; border-top-color: #3b82f6;
    border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0;
  }

  .tickets { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }

  @keyframes spin { to { transform: rotate(360deg); } }
`

// ─── Widget ───────────────────────────────────────────────────────────────────

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
    const matchInfo   = mk('div');                matchInfo.append(this._matchName, this._matchSub)
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
    this._scrapedData       = data
    this._matchNone.style.display = 'none'
    this._matchInfo.style.display = 'block'
    this._matchName.textContent   = data.match
    const n = Object.keys(data.markets ?? {}).length
    this._matchSub.textContent = `${n} marché${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}`
    this._analyzeBtn.disabled = false
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
        if (!res.tickets?.length) { this._setError('Aucun ticket reçu'); return }
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
    const COLORS = { SAFE: '#22c55e', MEDIUM: '#eab308', RISKY: '#ef4444' }
    const BG     = { SAFE: 'rgba(34,197,94,.07)', MEDIUM: 'rgba(234,179,8,.07)', RISKY: 'rgba(239,68,68,.07)' }
    const BORDER = { SAFE: 'rgba(34,197,94,.2)',  MEDIUM: 'rgba(234,179,8,.2)',  RISKY: 'rgba(239,68,68,.2)' }
    const ICONS  = { SAFE: '🟢', MEDIUM: '🟡', RISKY: '🔴' }
    const odd    = isNaN(t.odd) ? '×?' : `≈×${t.odd.toFixed(2)}`

    const card = mk('div')
    card.style.cssText = `border-radius:8px;padding:10px 12px;background:${BG[t.level]??'#1e293b'};border:1px solid ${BORDER[t.level]??'transparent'}`

    const header = mk('div')
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:7px'

    const lvl = mk('span')
    lvl.style.cssText = `font-size:10px;font-weight:700;letter-spacing:.5px;color:${COLORS[t.level]??'#475569'}`
    lvl.textContent = `${ICONS[t.level]??''} ${t.level}`

    const oddEl = mk('span')
    oddEl.style.cssText = 'font-size:13px;font-weight:800;color:#f1f5f9'
    oddEl.textContent = odd
    header.append(lvl, oddEl)

    const bets = mk('div')
    bets.style.cssText = 'display:flex;flex-direction:column;gap:3px'
    for (let i = 0; i < t.bets.length; i++) {
      const row = mk('div')
      row.style.cssText = 'font-size:11px;color:#94a3b8;display:flex;align-items:flex-start;gap:5px'
      const dot = mk('span')
      dot.style.cssText = 'width:4px;height:4px;border-radius:50%;background:#475569;margin-top:5px;flex-shrink:0'
      const txt = mk('span')
      txt.textContent = t.bets[i]
      const sel = t.selOdds?.[i]
      if (sel != null) {
        const s = mk('span')
        s.style.cssText = 'color:#475569;font-size:10px'
        s.textContent = ` (${sel.toFixed(2)})`
        txt.appendChild(s)
      }
      row.append(dot, txt)
      bets.appendChild(row)
    }
    card.append(header, bets)
    return card
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

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
      if (data && data.match !== lastMatch) {
        lastMatch = data.match
        widget.setMatch(data)
      }
    }, 800)
  }).observe(document.body, { childList: true, subtree: true })
}

mount()

// ─── Listener pour le popup (compatibilité) ───────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'SCRAPE_ODDS') return false
  const data = scrape()
  sendResponse({ ok: !!data, data })
  return false
})
