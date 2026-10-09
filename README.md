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
│   ├── LS1/           (one folder per show/season)
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


The script validates every episode file (valid JSON, required fields, unique
conversation ids, `importance` 1-5), warns about missing episode numbers and empty
`full`/`short` sections, and stops without touching `index.json` if it finds an
error. It also writes a `version` that the site uses to avoid stale cached data.
