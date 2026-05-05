const DEFAULT_BASE  = 'http://localhost:8080'
const DEFAULT_MODEL = 'qwen2.5-coder:latest'
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

function loadSettings() {
  return new Promise(resolve =>
      chrome.storage.local.get(['apiBase', 'apiModel', 'mode'], resolve)
  )
}

function buildPrompt(data, mode) {
  const selected = pickMarkets(data.markets)

  const lines = [
    'Tu es un expert en paris sportifs. Réponds UNIQUEMENT avec les 3 tickets, sans texte supplémentaire.',
    '',
    `Match : ${data.match}`,
    '',
    '=== MARCHÉS DISPONIBLES ===',
  ]

  for (const { key, rows } of selected) {
    lines.push(`\n${key} :`)
    for (const { label, odd } of rows.slice(0, 8)) {
      lines.push(`  - ${label} : ${odd.toFixed(2)}`)
    }
  }

  lines.push('')
  lines.push('=== RÈGLES (obligatoires) ===')
  lines.push('1. Chaque ticket combine 2 ou 3 marchés DIFFÉRENTS (jamais le même marché deux fois).')
  lines.push('2. Ne jamais associer 1X2 et Double Chance dans le même ticket (redondant).')
  lines.push('3. Cohérence entre sélections :')
  lines.push('   - "BTTS Oui" est incompatible avec "- de 1,5 buts"')
  lines.push('   - "+ de X,5" et "- de Y,5" avec X ≥ Y est impossible')
  lines.push('   - Un buteur de l\'équipe X est plus cohérent avec une victoire X ou BTTS Oui')
  lines.push('4. Bons combos football : 1X2 + Total buts · 1X2 + BTTS · BTTS + Total buts · Mi-temps + 1X2 · Buteur + 1X2')
  if (mode === 'aggressive') {
    lines.push('5. Mode agressif : vise des cotes combinées élevées (SAFE > 2.0, MEDIUM > 4.0, RISKY > 8.0).')
  } else {
    lines.push('5. SAFE : cote combinée < 2.5 · MEDIUM : entre 2.5 et 5.0 · RISKY : > 5.0')
  }
  lines.push('')
  lines.push('=== FORMAT (respecte exactement, rien d\'autre) ===')
  lines.push('')
  lines.push('Ticket 1 (SAFE):')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('Cote: [produit des cotes]')
  lines.push('')
  lines.push('Ticket 2 (MEDIUM):')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('Cote: [produit des cotes]')
  lines.push('')
  lines.push('Ticket 3 (RISKY):')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('Cote: [produit des cotes]')

  return lines.join('\n')
}

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

function parseTickets(text) {
  const tickets = []
  let current = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim().replace(/\*\*/g, '')

    const header = line.match(/ticket\s+\d+\s*[:\-–(]\s*\(?([A-Z]+)\)?/i)
    if (header) {
      if (current) tickets.push(current)
      current = { level: header[1].toUpperCase(), bets: [], _selOdds: [] }
      continue
    }
    if (!current) continue

    if (/c[oô]te?\s*(?:totale?|combin[eé]e?)?\s*:/i.test(line)) continue

    const bet = line.match(/^[-•*]\s*(.+)/)
    if (!bet || bet[1].length < 2) continue

    const betText = bet[1].trim()
    const atOdd = betText.match(/@\s*([\d.,]+)\s*$/)
    if (atOdd) {
      current._selOdds.push(parseFloat(atOdd[1].replace(',', '.')))
      current.bets.push(betText.replace(/@\s*[\d.,]+\s*$/, '').trim())
    } else {
      current.bets.push(betText)
    }
  }

  if (current) tickets.push(current)

  return tickets
    .filter(t => t.bets.length > 0)
    .map(t => {
      let odd = NaN
      if (t._selOdds.length === t.bets.length && t._selOdds.length > 0) {
        odd = parseFloat(t._selOdds.reduce((acc, o) => acc * o, 1).toFixed(2))
      }
      const selOdds = t._selOdds.length === t.bets.length ? t._selOdds : t.bets.map(() => null)
      return { level: t.level, bets: t.bets, selOdds, odd }
    })
}


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
