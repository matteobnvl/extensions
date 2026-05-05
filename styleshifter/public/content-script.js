// ── Badge flottant ────────────────────────────────────────────────────────────
class StyleBadge extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999999;
          font-family: sans-serif;
        }
        .badge {
          background: #1a1a2e;
          color: #e94560;
          border: 2px solid #e94560;
          border-radius: 20px;
          padding: 8px 18px;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 4px 15px rgba(233, 69, 96, 0.4);
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      </style>
      <div class="badge"><span id="label"></span></div>
    `;
    this._label = shadow.querySelector("#label");
  }

  static get observedAttributes() { return ["label"]; }

  attributeChangedCallback(name, _old, value) {
    if (name === "label") this._label.textContent = value;
  }
}

if (customElements && !customElements.get("style-badge")) {
  customElements.define("style-badge", StyleBadge);
}

let badgeEl = null;

function showBadge(label) {
  if (!badgeEl) {
    badgeEl = document.createElement("style-badge");
    document.body.appendChild(badgeEl);
  }
  badgeEl.setAttribute("label", label);
  clearTimeout(badgeEl._timer);
  badgeEl._timer = setTimeout(() => { badgeEl.remove(); badgeEl = null; }, 5000);
}

// ── Nœuds texte ───────────────────────────────────────────────────────────────
// id → { node: Text, original: string }
const aiNodeMap = new Map();
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "STYLE-BADGE"]);

function extractAINodes() {
  aiNodeMap.clear();
  let counter = 0;
  const result = [];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.textContent.trim().length < 2) return NodeFilter.FILTER_REJECT;
      let p = node.parentElement;
      while (p) {
        if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node;
  while ((node = walker.nextNode())) {
    const id = counter++;
    aiNodeMap.set(id, { node, original: node.textContent.trim() });
    result.push({ id, tag: node.parentElement?.tagName ?? "UNKNOWN", text: node.textContent.trim() });
  }

  return result;
}

function applyAINodes(nodes, label) {
  for (const { id, text } of nodes) {
    const entry = aiNodeMap.get(id);
    if (entry) entry.node.textContent = text;
  }
  if (label) showBadge(label);
}

function restoreAINodes() {
  aiNodeMap.forEach(({ node, original }) => { node.textContent = original; });
  if (badgeEl) { badgeEl.remove(); badgeEl = null; }
}

// ── Messages ──────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "ping") {
    sendResponse({ ok: true });
  } else if (message.action === "extractNodes") {
    sendResponse({ nodes: extractAINodes() });
  } else if (message.action === "applyNodes") {
    applyAINodes(message.nodes, message.label, message.theme);
    sendResponse({ success: true });
  } else if (message.action === "restoreNodes") {
    restoreAINodes();
    sendResponse({ success: true });
  }
});
