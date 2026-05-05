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
  // Fallback : si aucun marché reconnu (noms live différents), on prend tout
  if (!selected.length) {
    for (const [title, rows] of Object.entries(markets)) {
      selected.push({ key: title, rows })
    }
  }
  return selected
}

function loadSettings() {
  return new Promise(resolve =>
      chrome.storage.local.get(['apiBase', 'apiModel', 'mode'], resolve)
  )
}

function buildLiveContext(live) {
  if (!live) return null
  const lines = ['=== SITUATION EN DIRECT ===']
  lines.push(`Temps de jeu : ${live.timer} (durée réglementaire : 90 min, temps additionnel possible en fin de chaque mi-temps)`)
  lines.push(`Score actuel : ${live.score.home} - ${live.score.away}`)
  if (live.redCards.home > 0) lines.push(`Cartons rouges (domicile) : ${live.redCards.home}`)
  if (live.redCards.away > 0) lines.push(`Cartons rouges (extérieur) : ${live.redCards.away}`)
  return lines.join('\n')
}

function buildPrompt(data, mode) {
  const selected = pickMarkets(data.markets)
  const liveCtx  = buildLiveContext(data.live)

  const lines = [
    'Tu es un expert en paris sportifs. Réponds UNIQUEMENT avec les 3 tickets, sans texte supplémentaire.',
    '',
    `Match : ${data.match}`,
  ]

  if (liveCtx) {
    lines.push('')
    lines.push(liveCtx)
    lines.push('')
    lines.push('IMPORTANT : le match est EN COURS. Tiens compte du score, du temps restant et des cartons rouges pour évaluer la probabilité des marchés restants.')
    if (data.live.redCards.home > 0 || data.live.redCards.away > 0) {
      const team = data.live.redCards.home > 0 ? `${data.home} (${data.live.redCards.home} rouge${data.live.redCards.home > 1 ? 's' : ''})` : ''
      const team2 = data.live.redCards.away > 0 ? `${data.away} (${data.live.redCards.away} rouge${data.live.redCards.away > 1 ? 's' : ''})` : ''
      lines.push(`Avantage numérique : ${[team, team2].filter(Boolean).join(', ')} — à intégrer dans les pronostics.`)
    }
  }

  lines.push('')
  lines.push('=== MARCHÉS DISPONIBLES ===')


  for (const { key, rows } of selected) {
    lines.push(`\n${key} :`)
    for (const { label, odd } of rows.slice(0, 8)) {
      lines.push(`  - ${label} : ${odd.toFixed(2)}`)
    }
  }

  lines.push('')
  lines.push('=== RÈGLES (obligatoires) ===')
  lines.push('1. Propose 3 plans de paris différents (Plan 1, Plan 2, Plan 3).')
  lines.push('2. Chaque plan peut être un pari simple (1 marché) ou combiné (2-3 marchés). Le combiné n\'est pas obligatoire.')
  lines.push('3. COTE MAXIMALE : la cote finale de chaque plan ne doit PAS dépasser 7.00. INTERDIT d\'aller au-delà.')
  lines.push('4. Ne jamais mettre deux fois le même marché dans un plan combiné.')
  lines.push('5. Ne jamais associer 1X2 et Double Chance dans le même plan (redondant).')
  lines.push('6. Cohérence entre sélections :')
  lines.push('   - "BTTS Oui" est incompatible avec "- de 1,5 buts"')
  lines.push('   - Un buteur de l\'équipe X est plus cohérent avec une victoire X ou BTTS Oui')
  lines.push('7. Les 3 plans doivent avoir des cotes variées entre eux (pas 3 fois la même cote).')
  lines.push('8. VÉRIFIE le produit des cotes avant de répondre. Un plan avec une cote > 7.00 est INVALIDE.')
  lines.push('')
  lines.push('=== FORMAT (respecte exactement, rien d\'autre) ===')
  lines.push('')
  lines.push('Chaque ligne de pari = "- [Marché]: [Sélection] @ [cote exacte du bookmaker]"')
  lines.push('La cote après @ = UNIQUEMENT le nombre affiché dans les marchés ci-dessus. NE PAS l\'écrire dans le libellé.')
  lines.push('Exemple correct  : - 1X2: Victoire domicile @ 1.85')
  lines.push('Exemple INTERDIT : - 1X2: Victoire domicile : 1.85 @ 2.40')
  lines.push('')
  lines.push('Plan 1:')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('Cote: [produit des cotes]')
  lines.push('')
  lines.push('Plan 2:')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('- [Marché]: [Sélection] @ [cote]')
  lines.push('Cote: [produit des cotes]')
  lines.push('')
  lines.push('Plan 3:')
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

    const header = line.match(/^plan\s+(\d+)\s*:/i)
    if (header) {
      if (current) tickets.push(current)
      current = { level: `Plan ${header[1]}`, bets: [], _selOdds: [] }
      continue
    }
    if (!current) continue

    if (/c[oô]te?\s*(?:totale?|combin[eé]e?)?\s*:/i.test(line)) continue

    const bet = line.match(/^[-•*]\s*(.+)/)
    if (!bet || bet[1].length < 2) continue

    let betText = bet[1].trim()
    const atOdd = betText.match(/@\s*([\d.,]+)\s*$/)
    if (atOdd) {
      // Cas normal : "Sélection @ cote"
      let odd = parseFloat(atOdd[1].replace(',', '.'))
      betText = betText.replace(/@\s*[\d.,]+\s*$/, '').trim()

      // Cas dégradé : le LLM a écrit "Sélection : COTE_MARCHE @ AUTRE"
      // → la vraie cote bookmaker est celle après ":", on l'utilise à la place
      const inlineOdd = betText.match(/:\s*([\d.,]+)\s*$/)
      if (inlineOdd) {
        const marketOdd = parseFloat(inlineOdd[1].replace(',', '.'))
        if (marketOdd > 1.01) {
          odd = marketOdd
          betText = betText.replace(/:\s*[\d.,]+\s*$/, '').trim()
        }
      }

      current._selOdds.push(odd)
      current.bets.push(betText)
    } else {
      // Pas de "@" : le LLM a peut-être écrit "Sélection : cote"
      const inlineOdd = betText.match(/:\s*([\d.,]+)\s*$/)
      if (inlineOdd) {
        const marketOdd = parseFloat(inlineOdd[1].replace(',', '.'))
        if (marketOdd > 1.01) {
          current._selOdds.push(marketOdd)
          current.bets.push(betText.replace(/:\s*[\d.,]+\s*$/, '').trim())
        } else {
          current.bets.push(betText)
        }
      } else {
        current.bets.push(betText)
      }
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
      const outOfRange = !isNaN(odd) && odd > 7.00
      return { level: t.level, bets: t.bets, selOdds, odd, outOfRange }
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
