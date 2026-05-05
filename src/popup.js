import Alpine from '@alpinejs/csp'
import './bet-ticket.js'

document.addEventListener('alpine:init', () => {
  Alpine.data('betAnalyzer', () => ({

    // ── Panels (x-show attend une propriété booléenne directe) ─────────
    panelAnalyse:  true,
    panelSettings: false,

    // ── Tab active classes (:class attend une propriété string) ────────
    analyseTabClass:  'active',
    settingsTabClass: '',

    // ── Mode ───────────────────────────────────────────────────────────
    normalModeClass:     'active',
    aggressiveModeClass: '',
    _mode: 'normal',

    // ── Match ──────────────────────────────────────────────────────────
    noMatch:  true,
    hasMatch: false,
    matchName: '',
    matchSub:  '',
    _scrapedData: null,

    // ── Analyse ────────────────────────────────────────────────────────
    analyzeDisabled: true,
    loading:     false,
    loadingText: 'Analyse en cours…',
    hasError:  false,
    errorText: '',

    // ── Settings ───────────────────────────────────────────────────────
    apiBase:      '',
    apiModel:     '',
    saveFeedback: '',

    // ── Init ───────────────────────────────────────────────────────────
    init() {
      chrome.runtime.sendMessage({ type: 'LOAD_SETTINGS' }, res => {
        if (chrome.runtime.lastError) return
        const s = res?.settings ?? {}
        this.apiBase  = s.apiBase  ?? ''
        this.apiModel = s.apiModel ?? ''
      })
      this._autoScrape()
    },

    // ── Tab navigation ─────────────────────────────────────────────────
    gotoAnalyse() {
      this.panelAnalyse  = true;  this.panelSettings  = false
      this.analyseTabClass = 'active'; this.settingsTabClass = ''
    },
    gotoSettings() {
      this.panelAnalyse  = false; this.panelSettings  = true
      this.analyseTabClass = '';  this.settingsTabClass = 'active'
    },

    // ── Mode toggle ────────────────────────────────────────────────────
    setNormalMode() {
      this._mode = 'normal'
      this.normalModeClass = 'active'; this.aggressiveModeClass = ''
    },
    setAggressiveMode() {
      this._mode = 'aggressive'
      this.normalModeClass = '';  this.aggressiveModeClass = 'active'
    },

    // ── Auto-scrape on open ────────────────────────────────────────────
    _autoScrape() {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) return
        const host = tab.url ? new URL(tab.url).hostname.replace(/^www\./, '') : ''
        if (!host.includes('betclic')) return

        chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_ODDS' }, res => {
          if (chrome.runtime.lastError) return
          if (res?.ok && res.data) {
            this._scrapedData  = res.data
            this.matchName     = res.data.match
            const n = Object.keys(res.data.markets ?? {}).length
            this.matchSub      = `${n} marché${n > 1 ? 's' : ''} détecté${n > 1 ? 's' : ''}`
            this.noMatch       = false
            this.hasMatch      = true
            this.analyzeDisabled = false
          }
        })
      })
    },

    // ── Analyze ────────────────────────────────────────────────────────
    analyze() {
      if (!this._scrapedData) return

      this.loading  = true
      this.analyzeDisabled = true
      this.hasError = false
      this.errorText = ''
      document.getElementById('tickets-container').innerHTML = ''

      chrome.runtime.sendMessage(
        { type: 'ANALYZE', data: this._scrapedData, mode: this._mode },
        res => {
          this.loading = false
          this.analyzeDisabled = false

          if (!res?.ok) {
            this.hasError  = true
            this.errorText = '⚠ ' + (res?.error ?? 'Erreur inconnue')
            return
          }
          if (!res.tickets?.length) {
            this.hasError  = true
            this.errorText = '⚠ Aucun ticket reçu — vérifiez la réponse du modèle'
            return
          }
          this._renderTickets(res.tickets)
        }
      )
    },

    // Rendu des tickets via le Web Component <bet-ticket>
    // Alpine gère l'état, le WC gère l'affichage — les deux cohabitent
    _renderTickets(tickets) {
      const container = document.getElementById('tickets-container')
      container.innerHTML = ''
      for (const t of tickets) {
        const el = document.createElement('bet-ticket')
        el.setAttribute('level', t.level)
        el.setAttribute('odd', String(t.odd))
        // bets = [{text, odd}] pour afficher la cote individuelle dans le WC
        const bets = t.bets.map((text, i) => ({ text, odd: t.selOdds?.[i] ?? null }))
        el.setAttribute('bets', JSON.stringify(bets))
        container.appendChild(el)
      }
    },

    // ── Settings ───────────────────────────────────────────────────────
    saveSettings() {
      chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        settings: { apiBase: this.apiBase.trim(), apiModel: this.apiModel.trim() },
      }, () => {
        this.saveFeedback = 'Sauvegardé ✓'
        setTimeout(() => { this.saveFeedback = '' }, 2000)
      })
    },
  }))
})

Alpine.start()
