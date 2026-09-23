# Cahier des charges : Studio Visuel & Pont Agentique MCP (ScreenForge)

---

## 1. Vision & Nouveau Positionnement

### 1.1 Constat & Rupture
Limiter l'outil à une extension de navigateur posait des verrous majeurs :
- **Impossibilité d'inspecter les applications natives :** Impossible de capturer directement une fenêtre Electron (VS Code, Slack), un simulateur mobile (iOS/Android), ou une application desktop native.
- **Rupture avec l'environnement de dev :** Les agents modernes (Claude Code en terminal, Cursor, Claude Desktop) tournent localement et manipulent directement le système de fichiers et le shell.
- **Le besoin :** Faire de ScreenForge **le pont visuel et sémantique** entre l'humain (développeur ou designer/artiste) et l'agent codeur autonome.

### 1.2 Proposition de Valeur
Une application de bureau compagnon légère (Tauri/Rust) articulée autour de 5 piliers :
1. **Capture globale au niveau de l'OS :** Capture, recadrage et isolation de n'importe quelle fenêtre (navigateur, IDE, simulateur mobile, appli desktop).
2. **Atelier vectoriel infini sans compromis :** Canvas infini doté d'outils vectoriels précis (courbes de Bézier, opérations booléennes, calques) pour dessiner ou prototyper sans bridage artistique.
3. **Graphe relationnel & Workflows :** Liaison des composants entre eux (navigation, flux de données, logique d'état, chaînage d'instructions).
4. **Serveur MCP natif (Model Context Protocol) & Pont IDE/CLI :** Exposition du canvas et des nœuds sous forme d'outils et de ressources standardisées pour Claude, Cursor ou n'importe quel LLM/agent local.
5. **Onboarding & Authentification Zero-Friction (OAuth + Bearer) :** Connexion simplifiée en un clic via OAuth 2.0 (PKCE) pour l'utilisateur final et support des Bearer tokens pour les environnements automatisés/CLI.

---

## 2. Parcours Utilisateurs Cibles

### US-1 : Audit & Refactor visuel via Terminal / Claude Code
> *En tant que développeur utilisant Claude dans son terminal (`claude-code`), je capture un bug visuel sur une app Electron ou un site web. ScreenForge isole l'élément, extrait le vecteur et la capture, et expose un nœud. Dans mon terminal, je dis simplement à Claude : « Regarde le nœud #login-error sur ScreenForge et corrige le composant Tailwind localement ». Claude interroge le serveur MCP, lit la capture + la spec vectorielle, et applique le diff dans mon projet.*

### US-2 : Modélisation From Scratch par un Créatif / Designer
> *En tant qu'artiste/designer UI, j'ouvre ScreenForge, je trace un composant complexe à la plume vectorielle avec des masques et des dégradés. Je le lie à un deuxième état (composant survolé). L'agent IA lit ce flux via MCP et génère les composants React/CSS avec les transitions appropriées.*

### US-3 : Appairage instantané et sécurisé (OAuth & MCP)
> *En tant qu'utilisateur, je lance ScreenForge pour la première fois. Je clique sur « Connexion avec GitHub / Google / Anthropic » : mon navigateur s'ouvre, valide mon identité en OAuth, et ScreenForge s'associe automatiquement. Un simple bouton « Configurer Claude Desktop » injecte automatiquement les paramètres de connexion sans copier-coller de clé secrète manuelle.*

### US-4 : Workflow d'agents et orchestration visuelle
> *En tant qu'architecte, je modélise un graphe composé de 2 formulaires et 1 agent de validation backend. L'agent LLM lit le graphe complet via le connecteur MCP, comprend les types de données échangés entre les nœuds et génère à la fois le code frontend et l'API route correspondante.*

---

## 3. Architecture Globale & Pont MCP

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SCREENFORGE (Desktop Companion)                      │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │ Moteur de Capture Globale │      │       Canvas Infini         │   │
│   │ (OS-level Screen Snipping)│      │  (Vector Engine / Bézier)   │   │
│   └─────────────┬─────────────┘      └──────────────┬──────────────┘   │
│                 │                                   │                  │
│                 └─────────────────► ◄───────────────┘                  │
│                                     │                                  │
│                        Graphe Sémantique & Relations                   │
│                                     │                                  │
│                                     ▼                                  │
│                 Couche Sécurité & Auth (OAuth / Bearer)                │
│                                     │                                  │
│                                     ▼                                  │
│                        Serveur Local MCP / WebSocket                   │
│                       (stdio / Stream SSE sur localhost)               │
└─────────────────────────────────────┬──────────────────────────────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
   Claude Desktop / CLI         IDE (VS Code /           Agents Autonomes
  (claude-code via stdio)          Cursor via MCP)       (Scripts Python/TS)
```

---

## 4. Spécifications du Connecteur MCP & Sécurité

### 4.1 Stratégie d'Authentification Hybride (OAuth 2.0 + Bearer)

Afin d'éviter la friction de configuration manuelle tout en maintenant la compatibilité avec les scripts et l'outillage DevOps :

1. **Mode grand public / User-Friendly : OAuth 2.0 avec PKCE**
   - **Flux natif :** Utilisation du protocole *Authorization Code Grant avec PKCE* (RFC 7636), adapté aux applications clientes de bureau sans secret embarqué exposé.
   - **Deep Linking OS :** Redirection via un protocole personnalisé (`screenforge://auth/callback`) ou un port de bouclage HTTP éphémère (`http://127.0.0.1:port/callback`).
   - **Fournisseurs pris en charge :** GitHub, Google, Anthropic / OpenAI (selon les intégrations), ou SSO personnalisé.
   - **Trousseau système (Secure Enclave / Keyring) :** Stockage chiffré des Refresh & Access Tokens directement dans le trousseau de l'OS (Apple Keychain, Windows Credential Manager, Secret Service sous Linux via Rust).

2. **Mode Développeur / Headless : Bearer Token**
   - Génération de Personal Access Tokens (PAT) depuis l'interface de ScreenForge.
   - Idéal pour autoriser des requêtes distantes, des conteneurs Docker, ou des pipelines CI/CD.
   - Transmis dans l'en-tête HTTP : `Authorization: Bearer <token_secret>`.

3. **Transports MCP & Niveaux d'accès :**
   - **stdio :** Hérite des droits de l'environnement d'exécution local (pas d'en-tête nécessaire, sécurité isolée au processus).
   - **SSE / HTTP / WebSocket (Localhost ou Réseau) :** Nécessite soit la session OAuth active de l'utilisateur, soit un jeton Bearer valide.

### 4.2 Outils exposés (Tools)
* `get_canvas_snapshot()` : Capture d'ensemble du canvas (image globale + arborescence JSON de tous les nœuds).
* `get_node_detail(node_id)` : Récupération granulaire :
  * Image bitmap haute résolution (crop isolé).
  * Structure SVG vectorielle précise (`path`, dimensions, couleurs, styles).
  * Métadonnées et annotations rédigées par l'utilisateur.
* `get_node_dependencies(node_id)` : Liste des nœuds connectés en amont (inputs) et en aval (outputs) avec les types de payload définis.
* `update_node_preview(node_id, code_or_html)` : Permet à l'agent de renvoyer un composant généré (HTML/React live) directement dans le canvas pour afficher un aperçu en temps réel à côté du dessin original.
* `create_node_annotation(node_id, comment)` : Permet à l'agent de laisser des questions ou des suggestions directement sur le canvas visuel.

### 4.3 Ressources exposées (Resources)
* `screenforge://canvas/active` : Données du projet courant en temps réel.
* `screenforge://nodes/{node_id}/export.svg` : Export vectoriel propre du nœud.
* `screenforge://nodes/{node_id}/image.png` : Rendu pixel-perfect de la capture ou du dessin.

---

## 5. Spécifications Fonctionnelles

### 5.1 Module A : Capture & Ingestion Universelle (OS-Level)
* **Capture multi-écrans et multi-fenêtres :**
  * Raccourci global configurable (ex. `Cmd+Shift+X` ou `Ctrl+Alt+S`).
  * Détection automatique des fenêtres ouvertes au survol (fenêtre active, sous-fenêtre).
  * Sélecteur de zone libre (lasso rectangulaire ou forme polygonale).
* **Outils d'isolation post-capture :**
  * Découpe au cutter vectoriel, détourage intelligent.
  * Pipette de couleurs globale (EyeDropper natif OS).
  * Reconnaissance de texte intégrée (OCR local optionnel pour extraire les libellés).

### 5.2 Module B : Studio Vectoriel Infini ("Inkscape-like")
* **Moteur vectoriel haute précision :**
  * Tracés de Bézier avec manipulation des poignées de contrôle, nœuds lisses, angulaires ou symétriques.
  * Primitives géométriques dynamiques (rectangles à rayons multiples, polygones réguliers, cercles, étoiles).
  * Opérations booléennes temps réel : Union, Soustraction, Intersection, Exclusion.
  * Gestion avancée des calques, groupes hiérarchiques, masques d'écrêtage.
  * Remplissages complexes : aplats, dégradés linéaires/radiaux, motifs, ombres portées configurables.
* **Canvas infini interactif :**
  * Fluidité 60/120 FPS via accélération matérielle (WebGL/WebGPU).
  * Repères intelligents (smart snap), alignements automatiques et mesures d'espacement dynamiques (façon Figma).

### 5.3 Module C : Graphe Sémantique & Liens Relationnels
* **Connecteurs contextuels :**
  * Lignes courbes, orthogonales ou flèches magnétiques reliant des points d'ancrage sur les composants.
* **Typage des flux :**
  * **Flux d'interaction :** Déclencheur UI (`onClick`, `hover`, `drag`) vers transition d'écran ou modale.
  * **Flux de données :** Schémas typés (ex. passage d'un ID utilisateur ou d'un objet JSON).
  * **Flux agentique :** Étape de raisonnement (ex. `Prompt d'entrée` $\rightarrow$ `Agent de validation` $\rightarrow$ `Génération de code`).

### 5.4 Module D : Passerelle Terminal, Espace de Travail & Setup en 1 Clic
* **Bouton d'intégration MCP automatique :**
  * Détection de `claude_desktop_config.json` ou de la configuration Cursor.
  * Injection automatique de la configuration MCP avec les jetons d'authentification appropriés sans manipulation manuelle de fichiers JSON.
* **Détection du workspace local :**
  * ScreenForge peut être ouvert dans le répertoire d'un projet (`screenforge .` en CLI).
  * L'agent (via MCP ou CLI) peut directement écrire les fichiers générés dans les bons dossiers (`src/components/...`).
* **Live Preview :**
  * Bac à sable de rendu (Sandbox) permettant d'injecter du code React/Tailwind/HTML produit par l'agent directement dans un conteneur sur le canvas pour comparaison visuelle directe ("Dessin original" vs "Code généré").

---

## 6. Stack Technique Recommandée

| Composant | Technologie Proposée | Justification |
| :--- | :--- | :--- |
| **Application Desktop** | **Tauri (v2) + Rust** | Beaucoup plus léger et économe en RAM qu'Electron. Accès natif aux API système (raccourcis globaux, captures d'écrans multi-fenêtres, système de fichiers). |
| **Authentification & Clés** | `oauth2-rs` + `keyring-rs` + `tauri-plugin-deep-link` | Gestion robuste du protocole OAuth PKCE, écoute du callback custom scheme (`screenforge://`), et stockage sécurisé dans le trousseau de l'OS. |
| **Moteur Canvas / Graphe** | **tldraw SDK** ou **Pixi.js / Paper.js** | `tldraw` offre une base solide de canvas infini modulaire et extensible avec des shapes personnalisées. Paper.js ou Paper-boolean gèrent les opérations vectorielles mathématiques complexes. |
| **Moteur MCP** | **TypeScript SDK `@modelcontextprotocol/sdk`** | Implémentation officielle du protocole MCP, exécutable en mode serveur stdio (idéal pour Claude CLI / Claude Desktop) ou SSE (HTTP Server-Sent Events). |
| **Interface & Rendu** | React 19 + Tailwind CSS + Radix UI | Efficacité pour construire l'UI des inspecteurs, palettes d'outils et panneaux de configuration. |
| **Sandbox de Preview** | WebContainer / iframe sécurisée | Rendu instantané du code frontend généré par l'IA directement sur le canvas. |

---

## 7. Structure d'Échange MCP & En-tête Authentifié

Exemple d'appel via le transport SSE sécurisé par jeton :

```http
POST /mcp/tools/call HTTP/1.1
Host: 127.0.0.1:4545
Authorization: Bearer sf_pat_9a8f3b2e7c1d4a...
Content-Type: application/json

{
  "name": "get_node_detail",
  "arguments": {
    "node_id": "btn_custom_submit"
  }
}
```

Réponse JSON fournie par ScreenForge :

```json
{
  "id": "btn_custom_submit",
  "type": "vector_drawing",
  "name": "Bouton Soumettre avec Loader",
  "dimensions": { "width": 240, "height": 48 },
  "visual_context": {
    "svg": "<svg>...<rect rx='8' fill='url(#blueGrad)'/>...<path d='...' id='spinner'/>...</svg>",
    "colors_detected": ["#3B82F6", "#1D4ED8", "#FFFFFF"],
    "preview_base64_png": "data:image/png;base64,iVBORw0KGgo..."
  },
  "connections": [
    {
      "target_node": "modal_success",
      "trigger": "onSuccess",
      "payload_type": "ApiResponse<User>"
    }
  ],
  "user_instructions": "Bouton avec dégradé bleu, animation de spinner au clic, disabled tant que le formulaire est invalide."
}
```

---

## 8. Prochaines Étapes & Décisions Clés

1. **Mise en place de l'auth hybride :**
   - Prototype du flux OAuth 2.0 PKCE via Tauri (gestion du callback URI `screenforge://auth`).
   - Stockage local sécurisé des clés via `keyring-rs`.
2. **Setup en 1 clic du client MCP :**
   - Développement d'un injecteur automatique écrivant la configuration du serveur ScreenForge directement dans `claude_desktop_config.json` et dans le dossier `.cursor`.
3. **Priorité pour le prototype v1 (Proof of Concept) :**
   - **Étape 1 :** Fenêtre Tauri avec canvas infini + outil de capture globale d'écran.
   - **Étape 2 :** Serveur MCP minimal fonctionnant en stdio et SSE (authentifié par Bearer/OAuth).
   - **Étape 3 :** Outil de preview dynamique pour que Claude injecte le code généré en retour sur le canvas.