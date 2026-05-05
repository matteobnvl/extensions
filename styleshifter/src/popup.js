const STYLES = [
  {
    id: "medieval", emoji: "🏰", name: "Médiéval",
    prompt: `Réécris chaque texte en français médiéval courtois, en suivant EXACTEMENT ces règles d'orthographe et de style anciennes.

ORTHOGRAPHE ANCIENNE OBLIGATOIRE (c'est la règle la plus importante) :
- "vostre" à la place de "votre", "nostre" à la place de "notre"
- "estre" à la place de "être", "prest" à la place de "prêt"
- "devoient" à la place de "devaient", "avoient" à la place de "avaient"
- "encores" à la place de "encore", "ores" à la place de "or/maintenant"
- "maistre" à la place de "maître", "fayre" ou "faire" avec saveur ancienne

STYLE ET FORMULES :
- S'adresser en "très honoré seigneur" ou "gente dame" selon le contexte.
- Phrases longues et élaborées avec des subordonnées enchaînées.
- Expressions : "par la grâce des cieux", "d'aventure", "de concert", "sans heurt ni contrariété", "avec diligence et ardeur", "je m'en remets à vostre bon vouloir", "qu'il vous plaise".
- Signer en "vostre humble et obéissant serviteur".
- Conserver le sens du texte original, mais l'enrober dans cette rhétorique courtoise et solennelle.`,
  },
  {
    id: "soutenu", emoji: "🎩", name: "Soutenu",
    prompt: `Réécris chaque texte dans un registre extrêmement soutenu, digne d'un discours académique ou d'un texte littéraire du XIXe siècle.
Règles strictes :
- Vocabulary rare et précis : préfère "nonobstant" à "malgré", "susmentionné" à "ci-dessus", "parachever" à "terminer".
- Constructions syntaxiques longues et élaborées, avec des subordonnées et des incises.
- Aucune contraction familière, aucun mot courant si un synonyme savant existe.
- Utilise le subjonctif imparfait quand c'est pertinent : "fût-il", "quoi qu'il en soit".
- Ton grave, mesuré, légèrement condescendant, comme un académicien s'adressant à des profanes.`,
  },
  {
    id: "beauf", emoji: "🍺", name: "Beauf",
    prompt: `Réécris chaque texte comme un beauf français de 50 ans qui regarde le foot en mangeant des chips.
Règles strictes :
- Langage relâché avec fautes volontaires : "ch'uis", "j'dis", "y'a", "c'est des", "on s'en fout".
- Expressions typiques : "c'est bon ça hein", "franchement", "moi j'te dis", "c'est n'importe quoi", "à l'époque c'était mieux", "les jeunes de nos jours".
- Digressions inutiles sur la météo, le prix de l'essence ou la politique.
- Ponctuation approximative, phrases incomplètes, beaucoup de "bon" et "ben" en début de phrase.
- Ton râleur mais finalement bonhomme.`,
  },
  {
    id: "pirate", emoji: "🏴‍☠️", name: "Pirate",
    prompt: `Réécris chaque texte comme un pirate des Caraïbes au XVIIIe siècle, en français mais avec l'accent et le vocabulaire du bord.
Règles strictes :
- Interjections obligatoires : "Arrr !", "Mille sabords !", "Tonnerre de Brest !", "Par Davy Jones !".
- Vocabulaire maritime omniprésent : "tribord", "babord", "pavillon", "gréement", "flibustier", "corsaire", "doublons", "cale".
- Apostrophes des mots ("j'dis", "l'fond", "c'est") pour simuler l'accent rude.
- S'adresse à l'interlocuteur en "moussaillon", "vieille crapule" ou "camarade de bordée".
- Tout devient une aventure en mer, même les sujets les plus banals.`,
  },
  {
    id: "sms2007", emoji: "📱", name: "SMS 2007",
    prompt: `Réécris chaque texte comme un SMS envoyé depuis un Nokia en 2007 par un ado de 14 ans.
Règles strictes :
- Tout en minuscules, zéro majuscule, zéro accent.
- Abréviations phonétiques systématiques : "c" pour "c'est", "t" pour "tu", "g" pour "j'ai", "k" pour "que", "2" pour "de", "6" pour "si", "é" pour "et/est", "pk" pour "pourquoi", "jsp" pour "je sais pas", "tkt" pour "t'inquiète", "fé" pour "fais".
- Répétition de lettres pour l'emphase : "troooop", "ouaiiis", "nooon".
- "mdr" ou "lol" placés aléatoirement, parfois "ptdr".
- Ponctuation remplacée par "..." ou supprimée, jamais de point final.`,
  },
  {
    id: "bonjour", emoji: "👋", name: "Bonjour",
    prompt: "Remplace le texte de chaque fragment dont le tag est H1 par 'Bonjour !'. Pour tous les autres fragments, conserve le texte original à l'identique.",
  },
];

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_KEY   = __GROQ_API_KEY__;

let selectedStyle = null;

const grid         = document.getElementById("styles-grid");
const btnTransform = document.getElementById("btn-transform");
const btnRestore   = document.getElementById("btn-restore");
const statusEl     = document.getElementById("status");

chrome.storage.local.get("lastStyle", (data) => {
  if (data.lastStyle) select(data.lastStyle);
});

STYLES.forEach((style) => {
  const btn = document.createElement("button");
  btn.className = "style-btn";
  btn.dataset.id = style.id;
  btn.innerHTML = `<span class="style-emoji">${style.emoji}</span><span class="style-name">${style.name}</span>`;
  btn.addEventListener("click", () => select(style.id));
  grid.appendChild(btn);
});

function select(id) {
  selectedStyle = id;
  document.querySelectorAll(".style-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === id);
  });
  btnTransform.disabled = false;
  setStatus("", "");
}

btnTransform.addEventListener("click", async () => {
  if (!selectedStyle) return;
  const style = STYLES.find((s) => s.id === selectedStyle);

  btnTransform.disabled = true;
  btnTransform.textContent = "Extraction...";
  setStatus("", "");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const alive = await chrome.tabs.sendMessage(tab.id, { action: "ping" }).catch(() => null);
    if (!alive) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-script.js"] });
    }

    const { nodes } = await chrome.tabs.sendMessage(tab.id, { action: "extractNodes" });
    setStatus(`📤 ${nodes.length} nœuds — appel à Groq...`, "info");
    btnTransform.textContent = "Génération...";

    const transformed = await callGroq(style.prompt, nodes);

    btnTransform.textContent = "Application...";
    await chrome.tabs.sendMessage(tab.id, {
      action: "applyNodes",
      nodes: transformed,
      label: `${style.emoji} Mode ${style.name} actif`,
    });

    chrome.storage.local.set({ lastStyle: selectedStyle });
    setStatus(`✅ ${transformed.length} nœuds transformés !`, "success");
  } catch (err) {
    setStatus(`❌ ${err.message}`, "error");
  } finally {
    btnTransform.disabled = false;
    btnTransform.textContent = "Transformer";
  }
});

btnRestore.addEventListener("click", async () => {
  setStatus("", "");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab.id, { action: "restoreNodes" });
    setStatus("↩️ Texte restauré.", "success");
  } catch {
    setStatus("❌ Erreur lors de la restauration.", "error");
  }
});

const TPM_LIMIT = 6000;
const CHARS_PER_TOKEN = 1.5;
const PROMPT_OVERHEAD = 400;

function buildPayload(nodes) {
  const maxInputTokens = Math.floor((TPM_LIMIT - PROMPT_OVERHEAD) / 2);
  const charBudget = Math.floor(maxInputTokens * CHARS_PER_TOKEN);
  const selected = [];
  let total = 0;
  for (const node of nodes) {
    if (total + node.text.length > charBudget) break;
    selected.push(node);
    total += node.text.length;
  }
  const inputTokens = Math.ceil(total / CHARS_PER_TOKEN) + PROMPT_OVERHEAD;
  const maxCompletion = TPM_LIMIT - inputTokens;
  const text = selected.map(n => `[${n.id}] ${n.text}`).join("\n");
  return { text, maxCompletion };
}

function parseResponse(raw, nodes) {
  const map = Object.fromEntries(nodes.map(n => [n.id, n.text]));
  const result = [];
  for (const line of raw.split("\n")) {
    const match = line.match(/^\[(\d+)\]\s*(.+)/);
    if (!match) continue;
    const id = Number(match[1]);
    if (id in map) result.push({ id, text: match[2].trim() });
  }
  return result;
}

async function callGroq(prompt, nodes) {
  const { text: payload, maxCompletion } = buildPayload(nodes);
  const system = `Tu es un assistant de transformation de contenu web.
On te donne une liste de fragments de texte numérotés au format :
[id] texte

Transforme chaque fragment selon l'instruction.
Réponds UNIQUEMENT avec la même liste numérotée, même format, même ordre :
[id] texte transformé

Règles absolues :
- Si le fragment original est un seul mot ou une expression courte (moins de 4 mots), réponds avec UN seul mot ou une expression de longueur équivalente dans le style demandé. Ne génère jamais une phrase complète pour remplacer un mot.
- Ne modifie pas les URLs, emails, numéros de téléphone.
- Conserve tous les IDs.`;

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Instruction : ${prompt}\n\n${payload}` },
      ],
      temperature: 0.7,
      max_completion_tokens: maxCompletion,
      top_p: 1,
      stream: true,
      stop: null,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Groq inaccessible (HTTP ${response.status})${errBody ? " : " + errBody : ""}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      const chunk = JSON.parse(data);
      raw += chunk.choices[0]?.delta?.content ?? "";
    }
  }

  if (!raw) throw new Error("Réponse vide du modèle.");

  const result = parseResponse(raw, nodes);
  if (result.length === 0) throw new Error(`Aucun nœud parsé. Réponse : ${raw.slice(0, 200)}`);

  return result;
}

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className   = "status " + type;
  statusEl.style.display = msg ? "block" : "none";
}
