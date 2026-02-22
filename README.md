# Doodle Collection

A simple full-stack app:
- Draw or upload an image
- Let OpenAI extract a short visual query
- Fetch matching objects from the Cooper Hewitt collection
- Show results in a configurable gallery layout

## Project structure

```text
.
├── frontend/                 # React + Vite UI
│   └── src/
│       ├── features/
│       │   ├── analysis/     # Buttons, upload, query panel
│       │   ├── canvas/       # Drawing canvas
│       │   └── gallery/      # Gallery + layout strategy
│       ├── lib/              # API client + shared frontend types
│       ├── App.tsx
│       ├── main.tsx
│       └── styles.css
├── src/server/               # Deno API server
│   ├── services/
│   │   ├── imageAnalysis.ts
│   │   └── cooperHewitt.ts
│   ├── config.ts
│   ├── main.ts
│   └── types.ts
└── deno.json
```

## Setup

1. Add your key to `.env`:

```bash
OPENAI_API_KEY=your_key_here
```

2. Build frontend:

```bash
deno task build
```

3. Run server:

```bash
deno task start
```

Open [http://localhost:8000](http://localhost:8000).

## Change gallery structure later

Edit `frontend/src/features/gallery/layout.ts`:
- `DEFAULT_GALLERY_LAYOUT` changes the active layout
- `splitItemsByLayout()` controls how items are grouped into columns
