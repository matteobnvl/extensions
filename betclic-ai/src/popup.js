// ─── Tab switching ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active')
  })
})

// ─── Settings panel ───────────────────────────────────────────────────────────

const apiBaseInput  = document.getElementById('api-base')
const apiModelInput = document.getElementById('api-model')
const saveBtn       = document.getElementById('save-btn')
const saveFeedback  = document.getElementById('save-feedback')

chrome.runtime.sendMessage({ type: 'LOAD_SETTINGS' }, ({ settings }) => {
  if (settings.apiBase)  apiBaseInput.value  = settings.apiBase
  if (settings.apiModel) apiModelInput.value = settings.apiModel
})

saveBtn.addEventListener('click', () => {
  const apiBase  = apiBaseInput.value.trim()
  const apiModel = apiModelInput.value.trim()
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: { apiBase, apiModel } }, () => {
    showFeedback('Sauvegardé ✓', 'ok')
  })
})

function showFeedback(msg, cls) {
  saveFeedback.textContent = msg
  saveFeedback.className = 'save-feedback ' + cls
  setTimeout(() => { saveFeedback.className = 'save-feedback' }, 2000)
}

// ─── Mode toggle ──────────────────────────────────────────────────────────────

let mode = 'normal'
document.getElementById('mode-normal').addEventListener('click', () => setMode('normal'))
document.getElementById('mode-aggressive').addEventListener('click', () => setMode('aggressive'))

function setMode(m) {
  mode = m
  document.getElementById('mode-normal').classList.toggle('active', m === 'normal')
  document.getElementById('mode-aggressive').classList.toggle('active', m === 'aggressive')
}

// ─── Analyse ─────────────────────────────────────────────────────────────────

const analyzeBtn  = document.getElementById('analyze-btn')
const matchNone   = document.getElementById('match-none')
const matchInfo   = document.getElementById('match-info')
const matchName   = document.getElementById('match-name')
const matchSub    = document.getElementById('match-sub')
const errorBox    = document.getElementById('error-box')
const loadingBox  = document.getElementById('loading-box')
const loadingText = document.getElementById('loading-text')
const ticketsEl   = document.getElementById('tickets')

let scrapedData = null

// Auto-scrape on open to detect match
;(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return

  const host = tab.url ? new URL(tab.url).hostname.replace(/^www\./, '') : ''
  if (!host.includes('betclic')) return

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_ODDS' })
    if (res?.ok && res.data) {
      scrapedData = res.data
      matchNone.style.display = 'none'
      matchInfo.style.display = 'block'
      matchName.textContent   = res.data.match

      const n = Object.keys(res.data.markets ?? {}).length
      matchSub.textContent = `${n} marché${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}`

      analyzeBtn.disabled = false
    }
  } catch {
    // Content script not yet injected (page still loading) — silent fail
  }
})()

analyzeBtn.addEventListener('click', async () => {
  if (!scrapedData) return

  setLoading(true, 'Analyse en cours…')
  errorBox.style.display = 'none'
  ticketsEl.innerHTML = ''

  chrome.runtime.sendMessage({ type: 'ANALYZE', data: scrapedData, mode }, res => {
    setLoading(false)
    if (!res?.ok) {
      showError(res?.error ?? 'Erreur inconnue')
      return
    }
    if (!res.tickets?.length) {
      showError('Aucun ticket reçu — vérifiez le format de réponse du modèle')
      return
    }
    renderTickets(res.tickets)
  })
})

function setLoading(on, text = '') {
  analyzeBtn.disabled = on
  loadingBox.style.display = on ? 'flex' : 'none'
  if (text) loadingText.textContent = text
}

function showError(msg) {
  errorBox.textContent = '⚠ ' + msg
  errorBox.style.display = 'block'
}

function renderTickets(tickets) {
  const ICONS = { SAFE: '🟢', MEDIUM: '🟡', RISKY: '🔴' }
  ticketsEl.innerHTML = ''

  for (const t of tickets) {
    const card = document.createElement('div')
    card.className = `ticket ${t.level}`

    const header = document.createElement('div')
    header.className = 'ticket-header'

    const level = document.createElement('span')
    level.className = 'ticket-level'
    level.textContent = `${ICONS[t.level] ?? ''} ${t.level}`

    const odd = document.createElement('span')
    odd.className = 'ticket-odd'
    odd.textContent = `×${t.odd.toFixed(2)}`

    header.append(level, odd)

    const bets = document.createElement('div')
    bets.className = 'ticket-bets'
    for (const b of t.bets) {
      const row = document.createElement('div')
      row.className = 'ticket-bet'
      const dot = document.createElement('span')
      dot.className = 'bet-dot'
      const text = document.createElement('span')
      text.textContent = b
      row.append(dot, text)
      bets.appendChild(row)
    }

    card.append(header, bets)
    ticketsEl.appendChild(card)
  }
}
