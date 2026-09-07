# ResearchHub — Find Research Material & Similar Researchers

A free, open-source web app that makes research material discovery **easy** and,
uniquely, helps you **find similar researchers** — powered entirely by the
[OpenAlex](https://openalex.org/) open scholarly index. No API key required.
No backend required. Deploy to GitHub Pages in minutes.

## Features

- 🔍 **Instant paper search** — title, keyword, or author, powered by OpenAlex
- 🎛 **Faceted filters** — publication year, open-access only, topic (concept), sort order
- 👤 **Researcher profiles** — affiliation, ORCID, works count, citations, top research topics
- 🧑‍🤝‍🧑 **Find similar researchers** — Jaccard similarity over shared research
  concepts, with a transparent explanation of *why* each match is similar
- 📱 **Responsive card UI** — works on desktop and mobile
- ⚡ **Zero-config** — open `index.html` or push to GitHub Pages; no build step

## Quick start (local)

No dependencies required. Just serve the folder:

```bash
# Option A — Python
python3 -m http.server 8080
# open http://localhost:8080

# Option B — Node (requires npx)
npx serve .
```

The app calls the OpenAlex API directly from your browser.

## Deploy to GitHub Pages (zero cost)

1. Push this folder to a GitHub repo (as the repo root, or under `docs/`)
2. Go to **Settings → Pages**
3. Set **Source** to `Deploy from a branch`, choose `main`, folder `/` (or `/docs`)
4. The included `.github/workflows/ci.yml` also runs Pages deployment automatically
when `main` is configured for Pages via Actions.

## Architecture

| Layer ↕▾ | File ↕▾ | Responsibility ↕▾ |
|---|---|---|
| −UI shell | `index.html` | Semantic markup, hash router |
| −Styling | `css/styles.css` | Full design system |
| −API client | `js/openalex.js` | OpenAlex REST calls, rate limiting, error handling |
| −Similarity engine | `js/similarity.js` | Jaccard scoring, swappable algorithm interface |
| −Rendering | `js/ui.js` | Result cards, filters, similarity explanation |
| −App state/router | `js/app.js` | View switching, event binding, state |
⚙

### Similarity algorithm

The core "find similar researchers" feature uses **Jaccard similarity** over the
sets of research concepts (topics) each author works on:

```
J(A,B) = |concepts_A ∩ concepts_B| / |concepts_A ∪ concepts_B|
```

This is intentionally simple: it needs **no embeddings, no GPU, no database**,
and maps directly onto OpenAlex metadata. The module is isolated behind an
interface (`SimilarityEngine.score`) so a vector/embedding implementation can
be swapped in later without touching the UI.

## Data source

[OpenAlex](https://openalex.org/) — a free, CC0 index of ~250M scholarly works
and ~90M authors. No API key needed (polite pool: ~10 req/sec, which the client
respects).

## Project layout

```
research-hub/
├── index.html
├── css/styles.css
├── js/
│   ├── app.js
│   ├── openalex.js
│   ├── similarity.js
│   └── ui.js
├── .github/workflows/ci.yml
├── LICENSE
└── README.md
```

## Contributing

See `CONTRIBUTING.md` (coming in v2) or open an issue. The similarity engine
is the most interesting extension point — embeddings, coauthor overlap, and
citation-graph signals are all planned upgrades.

## License

MIT — see `LICENSE`.

