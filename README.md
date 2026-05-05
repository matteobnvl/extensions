# Betclic AI — Extension Chrome

Extension Chrome (Manifest V3) qui scrape les cotes d'un match Betclic et génère 3 tickets combinés via un LLM local (Ollama).

## Architecture

```
extensions/
├── src/
│   ├── content.js       # Script injecté sur betclic.fr — scraping des marchés
│   ├── background.js    # Service worker — construction du prompt, appel LLM, parsing
│   └── popup.js         # Logique du popup — orchestration et affichage
├── public/
│   └── manifest.json    # Manifest V3
├── popup.html           # UI du popup (2 onglets : Analyse / Paramètres)
├── vite.config.js           # Build popup.html
├── vite.content.config.js   # Build content.js (IIFE)
├── vite.background.config.js # Build background.js (IIFE)
└── dist/                # Sortie du build — à charger dans Chrome
```

## Fonctionnement

```
[Page Betclic] → content.js (scrape) → background.js (prompt + LLM) → popup.js (affichage)
```

### 1. Scraping (`content.js`)

Injecté sur `betclic.fr` et `betclic.com`. Répond au message `SCRAPE_ODDS` envoyé par le popup.

Sélecteurs Betclic utilisés :
- **Équipes** : `[data-qa="contestant-1-label"]` / `[data-qa="contestant-2-label"]`
- **Conteneur de marché** : `sports-markets-single-market.marketElement`
- **Titre du marché** : `h2.marketBox_headTitle`
- **Ligne d'une sélection** : `div.marketBox_lineSelection`
- **Label de sélection** : `p.marketBox_label` (ou `bcdk-bet-button-label.is-top` pour le 1X2)
- **Cote** : `bcdk-bet-button-label.btn_label:not(.is-top)`

Retourne un objet `{ match, home, away, markets }` où `markets` est un dictionnaire titre → `[{ label, odd }]`.

Marchés capturés (quand disponibles) :
| Titre Betclic | Clé interne |
|---|---|
| Résultat du match (tps rég.) | 1X2 |
| Double chance | Double chance |
| Les 2 équipes marquent | Les 2 équipes marquent (Oui/Non) |
| Nombre total de buts | Total de buts |
| Les 2 équipes marquent ou + de 2,5 buts | BTTS + Over 2.5 |
| 1ère mi-temps (seule) - Résultat | 1ère mi-temps |
| 2ème mi-temps (seule) - Résultat | 2ème mi-temps |
| Buteur (tps rég.) | Buteurs |

### 2. Prompt & LLM (`background.js`)

Reçoit les données scrapées, sélectionne les marchés pertinents, construit un prompt structuré et appelle le LLM via l'API OpenAI-compatible d'Ollama.

**Règles injectées dans le prompt :**
- 2 à 3 marchés différents par ticket (pas de doublon 1X2 + Double Chance)
- Cohérence des sélections (BTTS Oui ≠ -1.5 buts, pas de +X et -Y avec X ≥ Y, etc.)
- Bons combos suggérés : `1X2 + Total buts`, `1X2 + BTTS`, `Mi-temps + 1X2`, `Buteur + 1X2`
- Cibles de cotes : SAFE < 2.5 · MEDIUM 2.5–5.0 · RISKY > 5.0

**Calcul de la cote combinée :** le modèle indique chaque cote individuelle au format `@ X.XX`. Le background les extrait et calcule lui-même le produit — la valeur fournie par le LLM est ignorée.

### 3. Popup (`popup.html` + `popup.js`)

Deux onglets :
- **Analyse** : détecte automatiquement le match au chargement, bouton "Analyser ce match", affiche les 3 tickets
- **Paramètres** : URL Ollama (`http://localhost:8080` par défaut) et nom du modèle

Les paramètres sont stockés dans `chrome.storage.local`.

## Installation

### Prérequis

- [Ollama](https://ollama.com) avec le modèle `qwen2.5-coder:latest`
- Node.js 18+

### Lancer Ollama

```bash
ollama pull qwen2.5-coder
OLLAMA_HOST=0.0.0.0:8080 ollama serve
```

### Build

```bash
npm install
npm run build
```

### Charger dans Chrome

1. Ouvrir `chrome://extensions`
2. Activer le **Mode développeur** (en haut à droite)
3. Cliquer **Charger l'extension non empaquetée**
4. Sélectionner le dossier `dist/`

### Utilisation

1. Aller sur une page de match Betclic (ex : `betclic.fr/fr-fr/sport/football/...`)
2. Ouvrir l'extension via l'icône dans la barre Chrome
3. Le match est détecté automatiquement — cliquer **Analyser ce match**
4. Les 3 tickets s'affichent avec leur cote combinée calculée

## Développement

```bash
npm run dev   # build en watch mode (rechargement automatique du dist/)
```

Recharger l'extension manuellement dans `chrome://extensions` après chaque build (ou utiliser l'extension [Extensions Reloader](https://chromewebstore.google.com/detail/extensions-reloader/fimgfedafeadlieiabdeeaodndnlbhid)).

## Modèle LLM

Par défaut : `qwen2.5-coder:latest` via Ollama sur `http://localhost:8080`.

Tout endpoint compatible OpenAI fonctionne (Ollama, LM Studio, OpenAI, Mistral, etc.). La base URL et le modèle sont configurables dans l'onglet **Paramètres** du popup.
