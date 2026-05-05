const THEME = {
  SAFE:   { color: '#22c55e', bg: 'rgba(34,197,94,.07)',  border: 'rgba(34,197,94,.2)',  icon: '🟢' },
  MEDIUM: { color: '#eab308', bg: 'rgba(234,179,8,.07)',  border: 'rgba(234,179,8,.2)',  icon: '🟡' },
  RISKY:  { color: '#ef4444', bg: 'rgba(239,68,68,.07)',  border: 'rgba(239,68,68,.2)',  icon: '🔴' },
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

class BetTicket extends HTMLElement {
  static observedAttributes = ['level', 'odd', 'bets']

  connectedCallback() {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' })
    this._render()
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this._render()
  }

  _render() {
    const level = this.getAttribute('level') ?? ''
    const odd   = parseFloat(this.getAttribute('odd') ?? 'NaN')
    const bets  = JSON.parse(this.getAttribute('bets') ?? '[]')
    const t     = THEME[level] ?? { color: '#475569', bg: '#1e293b', border: 'transparent', icon: '' }
    const oddStr = isNaN(odd) ? '×?' : `≈×${odd.toFixed(2)}`

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .card {
          border-radius: 8px;
          padding: 10px 12px;
          background: ${t.bg};
          border: 1px solid ${t.border};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 7px;
        }
        .level {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: ${t.color};
        }
        .odd { font-size: 13px; font-weight: 800; color: #f1f5f9; }
        .bets { display: flex; flex-direction: column; gap: 3px; }
        .bet {
          font-size: 11px;
          color: #94a3b8;
          display: flex;
          align-items: flex-start;
          gap: 5px;
        }
        .dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #475569;
          margin-top: 5px;
          flex-shrink: 0;
        }
        .bet-odd { color: #475569; font-size: 10px; white-space: nowrap; }
      </style>
      <div class="card">
        <div class="header">
          <span class="level">${t.icon} ${esc(level)}</span>
          <span class="odd">${esc(oddStr)}</span>
        </div>
        <div class="bets">
          ${bets.map(b => {
            const text = typeof b === 'string' ? b : b.text
            const odd  = typeof b === 'object' && b.odd != null ? ` <span class="bet-odd">(${b.odd.toFixed(2)})</span>` : ''
            return `<div class="bet"><span class="dot"></span><span>${esc(text)}${odd}</span></div>`
          }).join('')}
        </div>
      </div>
    `
  }
}

try { customElements.define('bet-ticket', BetTicket) } catch {}
