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
          border-radius: 12px;
          padding: 12px 14px;
          background: #FFFFFF;
          border: 1px solid ${t.border};
          border-left: 4px solid ${t.color};
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #F3F4F6;
        }
        .level {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: ${t.color};
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .odd { font-size: 16px; font-weight: 900; color: #111827; background: #F3F4F6; padding: 4px 10px; border-radius: 16px; }
        .bets { display: flex; flex-direction: column; gap: 6px; }
        .bet {
          font-size: 12px;
          color: #374151;
          display: flex;
          align-items: flex-start;
          gap: 6px;
          font-weight: 500;
        }
        .dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #D1D5DB;
          margin-top: 6px;
          flex-shrink: 0;
        }
        .bet-odd { color: #6B7280; font-size: 11px; font-weight: 700; white-space: nowrap; margin-left: 4px; }
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
