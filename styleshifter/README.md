# StyleShifter

Extension Chrome qui transforme le texte d'une page web dans un style choisi (médiéval, pirate, SMS 2007…) via un modèle Ollama local.

## Prérequis

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/)

## Installation

### 1. Dépendances Node

```bash
npm install
```

### 2. Serveur Ollama

Lance le container Docker (démarre Ollama et télécharge automatiquement le modèle `qwen2.5-coder:latest`) :

```bash
docker compose up -d
```

Le premier démarrage peut prendre quelques minutes le temps de pull le modèle.

### 3. Build de l'extension

```bash
npm run build
```

Le dossier `dist/` est généré à la racine du projet.

### 4. Charger l'extension dans Chrome

1. Ouvre `chrome://extensions`
2. Active le **Mode développeur** (interrupteur en haut à droite)
3. Clique sur **Charger l'extension non empaquetée**
4. Sélectionne le dossier `dist/`

## Développement

Pour rebuilder automatiquement à chaque modification :

```bash
npm run dev
```

## Utilisation

1. Ouvre n'importe quelle page web
2. Clique sur l'icône StyleShifter dans la barre d'extensions
3. Choisis un style
4. Clique sur **Transformer**
