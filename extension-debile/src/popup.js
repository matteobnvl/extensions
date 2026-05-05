chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const el = document.getElementById('status')
  if (!el) return
  const supported = [
    'betclic.fr', 'betclic.com',
    'winamax.fr', 'unibet.fr', 'pmu.fr',
  ]
  const host = tab?.url ? new URL(tab.url).hostname.replace(/^www\./, '') : ''
  el.textContent = supported.includes(host) ? 'Injecté ✓' : 'Site non supporté'
  el.style.color = supported.includes(host) ? '#22c55e' : '#f59e0b'
})
