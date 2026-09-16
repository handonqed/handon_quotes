# Handon Quotes

Static searchable quote/conversation database for GitHub Pages.

## Structure

```text
handon-quotes/
├── index.html
├── css/style.css
├── js/
│   ├── app.js
│   ├── data.js
│   └── ui.js
├── data/
│   ├── index.json
│   ├── TO/
│   ├── LS1/
│   ├── LS2/
│   └── ...
└── generate_index.py
```

The website uses the existing episode JSON format: `show`, `season`, `episode`,
`episode_id`, `episode_title`, `conversations`, conversation metadata,
`full.turns`, and `short.turns`.

Put new JSON files under `data/`, then run:

```bash
python generate_index.py
```

Commit and push the repository to GitHub. Enable GitHub Pages from
**Settings -> Pages -> Deploy from branch -> main -> root**.

The browser loads the JSON files with `fetch()`, so GitHub Pages (or another
web server) is required; opening `index.html` directly with `file://` may be
blocked by browser security.
