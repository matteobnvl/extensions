// ─── Helpers ──────────────────────────────────────────────────────────────────

function oddFromBtn(btn) {
  // Odd value is in the btn_label WITHOUT the is-top class
  const label = btn.querySelector('bcdk-bet-button-label.btn_label:not(.is-top)')
  if (!label) return null
  const val = parseFloat(label.textContent.replace(/<!---->/g, '').replace(',', '.').trim())
  return val > 1.01 && val < 100 ? val : null
}

function teamNameFromBtn(btn) {
  // 1X2 style: team name is in btn_label.is-top, split across two spans (.ellipsis + .clip)
  const label = btn.querySelector('bcdk-bet-button-label.btn_label.is-top')
  if (!label) return null
  return [...label.querySelectorAll('span')].map(s => s.textContent).join('').trim()
}

// ─── Generic market scraper ────────────────────────────────────────────────────
// Each marketBox_lineSelection row has either:
//   - p.marketBox_label (text label) + button[betbuttontype="odd"]   → most markets
//   - bcdk-bet-button-label.is-top (team name) + btn_label (odd)     → 1X2

function scrapeMarketRows(marketEl) {
  const rows = []
  for (const line of marketEl.querySelectorAll('div.marketBox_lineSelection')) {
    const btn = line.querySelector('button[betbuttontype="odd"]')
    if (!btn) continue
    const odd = oddFromBtn(btn)
    if (!odd) continue

    // Prefer explicit p.marketBox_label, fall back to is-top team name
    const labelEl = line.querySelector('p.marketBox_label')
    const label = labelEl
      ? labelEl.textContent.trim()
      : (teamNameFromBtn(btn) ?? '')

    if (label) rows.push({ label, odd })
  }
  return rows
}

// ─── Main scrape ──────────────────────────────────────────────────────────────

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

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'SCRAPE_ODDS') return false
  const data = scrape()
  sendResponse({ ok: !!data, data })
  return false
})
