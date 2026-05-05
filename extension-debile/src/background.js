const API_HOST = 'flashscore4.p.rapidapi.com'
const BASE_URL = `https://${API_HOST}`

async function getApiKey() {
  return new Promise(resolve => {
    chrome.storage.local.get('rapidApiKey', ({ rapidApiKey }) => resolve(rapidApiKey ?? null))
  })
}

async function flashscoreGet(path, params = {}) {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('API key not configured')

  const url = new URL(BASE_URL + path)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key':  apiKey,
      'x-rapidapi-host': API_HOST,
    },
  })

  if (!res.ok) throw new Error(`FlashScore API ${res.status}: ${res.statusText}`)
  return res.json()
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'SET_API_KEY') {
    chrome.storage.local.set({ rapidApiKey: msg.key }, () => sendResponse({ ok: true }))
    return true
  }

  if (msg.type === 'GET_API_KEY') {
    getApiKey().then(key => sendResponse({ ok: true, key }))
    return true
  }

  if (msg.type !== 'FLASHSCORE') return false

  flashscoreGet(msg.path, msg.params ?? {})
    .then(data => sendResponse({ ok: true, data }))
    .catch(err  => sendResponse({ ok: false, error: err.message }))

  return true
})