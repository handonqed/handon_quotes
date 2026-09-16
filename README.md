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


