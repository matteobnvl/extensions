const API_KEY  = 'd887fd209fmshb7327c7fbed4686p161006jsn97c8b299062b'
const API_HOST = 'flashscore4.p.rapidapi.com'
const BASE_URL = `https://${API_HOST}`

async function flashscoreGet(path, params = {}) {
  const url = new URL(BASE_URL + path)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      'x-rapidapi-key':  API_KEY,
      'x-rapidapi-host': API_HOST,
    },
  })

  if (!res.ok) throw new Error(`FlashScore API ${res.status}: ${res.statusText}`)
  return res.json()
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'FLASHSCORE') return false

  flashscoreGet(msg.path, msg.params ?? {})
    .then(data => sendResponse({ ok: true, data }))
    .catch(err  => sendResponse({ ok: false, error: err.message }))

  return true // keep the message channel open for async sendResponse
})