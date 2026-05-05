const DEFAULT_BASE  = 'http://localhost:8080'
const DEFAULT_MODEL = 'qwen2.5-coder:latest'

// ─── Settings ─────────────────────────────────────────────────────────────────

function loadSettings() {
  return new Promise(resolve =>
    chrome.storage.local.get(['apiBase', 'apiModel', 'mode'], resolve)
  )
}

// ─── Market selection ─────────────────────────────────────────────────────────
// Pick markets that are useful for combined bets, in display order.

const RELEVANT = [
  { key: '1X2',            match: t => /résultat du match/i.test(t) },
  { key: 'Double chance',  match: t => /double chance/i.test(t) && !/buteur/i.test(t) },
  { key: 'Les 2 équipes marquent (Oui/Non)', match: t => /les 2 équipes marquent\s*$/i.test(t.trim()) },
  { key: 'Total de buts',  match: t => /nombre total de buts/i.test(t) },
  { key: 'BTTS + Over 2.5', match: t => /les 2 équipes marquent ou/i.test(t) },
  { key: '1ère mi-temps',  match: t => /1ère mi-temps/i.test(t) && /résultat/i.test(t) },
  { key: '2ème mi-temps',  match: t => /2ème mi-temps/i.test(t) && /résultat/i.test(t) },
  { key: 'Buteurs',        match: t => /buteur \(tps/i.test(t) },
]

function pickMarkets(markets) {
  const selected = []
  for (const { key, match } of RELEVANT) {
    const title = Object.keys(markets).find(t => match(t))
    if (!title) continue
    selected.push({ key, rows: markets[title] })
  }
  return selected
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(data, mode) {
  const selected = pickMarkets(data.markets)

  const lines = [
    'Tu es un expert en paris sportifs. Réponds UNIQUEMENT avec les 3 tickets demandés, sans aucun autre texte.',
    '',
    `Match : ${data.match}`,
    '',
    '=== MARCHÉS ET COTES DISPONIBLES ===',
  ]

  for (const { key, rows } of selected) {
    lines.push(`\n${key} :`)
    for (const { label, odd } of rows.slice(0, 8)) {
      lines.push(`  - ${label} : ${odd.toFixed(2)}`)
    }
  }

  lines.push('')
  lines.push('=== CONSIGNE ===')
  if (mode === 'aggressive') {
    lines.push('Mode agressif : favorise les combinaisons avec des cotes élevées (RISKY > 5.00).')
  } else {
    lines.push('Mode normal : équilibre risque et rendement.')
  }
  lines.push('')
  lines.push('Génère exactement 3 tickets combinés (SAFE, MEDIUM, RISKY).')
  lines.push('Règles :')
  lines.push('  - 2 ou 3 sélections par ticket, issues de marchés DIFFÉRENTS')
  lines.push('  - Sélections cohérentes, sans contradiction (ex: pas "BTTS Oui" + "0-0")')
  lines.push('  - Cote totale = produit des cotes sélectionnées (calcule-la exactement)')
  lines.push('')
  lines.push('Format de réponse strict (rien d\'autre) :')
  lines.push('')
  lines.push('Ticket 1 (SAFE):')
  lines.push('- [marché]: [sélection] @ X.XX')
  lines.push('- [marché]: [sélection] @ X.XX')
  lines.push('Cote: X.XX')
  lines.push('')
  lines.push('Ticket 2 (MEDIUM):')
  lines.push('- [marché]: [sélection] @ X.XX')
  lines.push('- [marché]: [sélection] @ X.XX')
  lines.push('Cote: X.XX')
  lines.push('')
  lines.push('Ticket 3 (RISKY):')
  lines.push('- [marché]: [sélection] @ X.XX')
  lines.push('- [marché]: [sélection] @ X.XX')
  lines.push('- [marché]: [sélection] @ X.XX')
  lines.push('Cote: X.XX')

  return lines.join('\n')
}

// ─── LLM call ────────────────────────────────────────────────────────────────

async function callLLM(prompt, apiBase, apiModel) {
  const base  = (apiBase  ?? DEFAULT_BASE).replace(/\/$/, '')
  const model = (apiModel ?? DEFAULT_MODEL)
  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages:    [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens:  800,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`)
  }

  return (await res.json()).choices?.[0]?.message?.content ?? ''
}

// ─── Response parser ──────────────────────────────────────────────────────────
// Line-by-line approach: more robust than a single regex against LLM output.

function parseTickets(text) {
  const tickets = []
  let current = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim().replace(/\*\*/g, '')  // strip markdown bold

    // Header: "Ticket 1 (SAFE):" or "Ticket 1 - SAFE" etc.
    const header = line.match(/ticket\s+\d+\s*[:\-–(]\s*\(?([A-Z]+)\)?/i)
    if (header) {
      if (current) tickets.push(current)
      current = { level: header[1].toUpperCase(), bets: [], odd: NaN }
      continue
    }
    if (!current) continue

    // Cote line: "Cote: 2.14" or "Côte totale: 2.14"
    const cote = line.match(/c[oô]te?\s*(?:totale?|combin[eé]e?)?\s*:?\s*([\d.,]+)/i)
    if (cote) {
      current.odd = parseFloat(cote[1].replace(',', '.'))
      continue
    }

    // Bet line: "- [marché]: sélection @ X.XX" or "- sélection"
    const bet = line.match(/^[-•*]\s*(.+)/)
    if (bet && bet[1].length > 2) {
      current.bets.push(bet[1].trim())
    }
  }

  if (current) tickets.push(current)
  return tickets.filter(t => t.bets.length > 0)
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set(msg.settings, () => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'LOAD_SETTINGS') {
    loadSettings().then(s => sendResponse({ ok: true, settings: s }))
    return true
  }

  if (msg.type !== 'ANALYZE') return false

  ;(async () => {
    const { apiBase, apiModel, mode } = await loadSettings()
    const prompt  = buildPrompt(msg.data, mode)
    const raw     = await callLLM(prompt, apiBase, apiModel)
    const tickets = parseTickets(raw)
    sendResponse({ ok: true, tickets, raw })
  })().catch(err => sendResponse({ ok: false, error: err.message }))

  return true
})
