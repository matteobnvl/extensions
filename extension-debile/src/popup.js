const input    = document.getElementById('api-key-input')
const saveBtn  = document.getElementById('save-btn')
const feedback = document.getElementById('feedback')
const keyDot   = document.getElementById('key-dot')
const keyLabel = document.getElementById('key-label')
const toggle   = document.getElementById('toggle-visibility')
const statusEl = document.getElementById('status')

function setKeyStatus(hasKey) {
  keyDot.className = 'key-dot ' + (hasKey ? 'set' : 'unset')
  keyLabel.textContent = hasKey ? 'Clé configurée' : 'Aucune clé enregistrée'
}

function showFeedback(msg, type) {
  feedback.textContent = msg
  feedback.className = 'feedback ' + type
  setTimeout(() => { feedback.textContent = ''; feedback.className = 'feedback' }, 2500)
}

// Load current state
chrome.runtime.sendMessage({ type: 'GET_API_KEY' }, ({ key }) => {
  setKeyStatus(!!key)
  if (key) input.value = key
})

// Tab status
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const supported = ['betclic.fr', 'betclic.com', 'winamax.fr', 'unibet.fr', 'pmu.fr']
  const host = tab?.url ? new URL(tab.url).hostname.replace(/^www\./, '') : ''
  statusEl.textContent = supported.includes(host) ? 'Injecté ✓' : 'Site non supporté'
  statusEl.style.color = supported.includes(host) ? '#22c55e' : '#f59e0b'
})

toggle.addEventListener('click', () => {
  input.type = input.type === 'password' ? 'text' : 'password'
})

saveBtn.addEventListener('click', () => {
  const key = input.value.trim()
  if (!key) { showFeedback('Clé vide', 'err'); return }

  saveBtn.disabled = true
  chrome.runtime.sendMessage({ type: 'SET_API_KEY', key }, ({ ok }) => {
    saveBtn.disabled = false
    if (ok) {
      setKeyStatus(true)
      showFeedback('Clé sauvegardée ✓', 'ok')
    } else {
      showFeedback('Erreur lors de la sauvegarde', 'err')
    }
  })
})
