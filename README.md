# Flowboard

Flowboard is a local-first Kanban board built with React, TypeScript, and Tailwind CSS. It keeps your board in the browser, so you can plan work without an account, backend, or network round-trips.

## Features

- Default columns: **To Do**, **In Progress**, **Review**, **Done**
- Add, rename, delete, and drag to reorder columns
- Add, edit, and delete cards with title, description, priority, due date, labels, and assignee
- Drag and drop cards between columns and reorder cards within a column
- Click any card to open the detail editor
- Manage labels in Settings: create, rename, merge, delete, and see usage counts
- Search plus label and priority filters
- Overdue and due-today indicators
- Local browser persistence (SQLite WASM with `localStorage` fallback)
- JSON export and validated JSON import
- Persisted light/dark theme
- Responsive layout with fluid desktop columns and horizontally scrollable columns on small screens
- Keyboard-accessible drag and drop

A small starter board is added on first run. You can delete or replace it at any time.

## Tech stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- [@dnd-kit](https://dndkit.com/) for drag and drop
- [Zustand](https://zustand.docs.pmnd.rs/) with `persist` middleware for state
- [SQLite Wasm](https://sqlite.org/wasm/doc/trunk/index.md) for browser-side persistence
- [date-fns](https://date-fns.org/) for date handling
- [nanoid](https://github.com/ai/nanoid) for ID generation
- [oxlint](https://oxc.rs/) for linting

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (22+ recommended)
- npm

## Local setup

```bash
# Install dependencies
npm install

# Start the dev server with HMR
npm run dev
```

Vite prints a local URL (usually `http://localhost:5173`).

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production (`tsc -b && vite build`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run oxlint |

## Using Flowboard

- **Cards:** Click a card (or its pencil button) to edit it. Use **Add card** at the bottom of a column to create one. Delete a card from inside the card editor.
- **Dragging:** Drag cards between columns or onto another card to reorder. Use the grip handle in a column header to reorder columns. On touch screens, press and hold a card briefly before moving it.
- **Keyboard:** Focus a card and press `Enter` to edit it. Press `Space` to pick it up, use arrow keys to move it, press `Space` to drop it, or press `Escape` to cancel. Column handles work the same way.
- **Filters:** Search matches card titles, descriptions, labels, and assignees. Label and priority filters combine with search. The result count appears in the toolbar.
- **Dark mode:** Use the sun/moon button in the header. Your choice is remembered.
- **Export/import:** **Export** downloads the current board as JSON. **Import** validates the file and asks for confirmation before replacing the current board. Export a backup first if needed.

## Persistence

There is no backend. Flowboard stores data in the browser using SQLite (WebAssembly) with a `localStorage` fallback:

- `flowboard.board` stores columns, cards, and labels
- `flowboard.ui` stores the selected theme

SQLite initializes asynchronously, so the app shows a short loading screen on first render. If SQLite cannot initialize (for example: unsupported browser, private mode, storage quota issue, or WASM load failure), Flowboard falls back to `localStorage`.

Clearing site data resets the app to the starter board. Because storage is per browser and per origin, boards are not shared across devices. Use export/import to move data.

## Project structure

```text
src/
├─ components/        # App components and modals
│  └─ ui/             # Reusable UI primitives
├─ db/                # SQLite WASM initialization and storage access
├─ store/             # Zustand stores and storage adapter
├─ types/             # Shared TypeScript types
├─ utils/             # Dates, filtering, labels, import/export, helpers
├─ App.tsx            # App shell and hydration/theme handling
├─ index.css          # Global styles
└─ main.tsx           # Entry point
```

## Deployment

The app is a static single-page site. The build output is written to `dist/`.

### Vercel

1. Push the project to a Git repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite automatically. Confirm:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Deploy. No environment variables are required.

You can also deploy with the CLI:

```bash
npx vercel --prod
```

### Netlify

1. Push the project to a Git repository.
2. In Netlify, choose **Add new site → Import existing project**.
3. Set:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Deploy. If Netlify uses an older Node version, set `NODE_VERSION=22` in site environment variables.

Or deploy the built output directly:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

No SPA redirect is needed because the app has no client-side router.

## Export format

Exported JSON contains the full board:

```json
{
  "columns": [
    { "id": "todo", "title": "To Do", "order": 0 }
  ],
  "cards": [
    {
      "id": "welcome",
      "columnId": "todo",
      "title": "Welcome to Flowboard",
      "description": "This is a sample card. Click it to edit or drag it around.",
      "priority": "medium",
      "dueDate": null,
      "labels": ["Example"],
      "assignee": "Alex",
      "position": 0
    }
  ],
  "labels": ["Example"]
}
```

Notes:

- `priority` must be `low`, `medium`, or `high`.
- `dueDate` must be `null` or a valid `YYYY-MM-DD` date.
- Column and card IDs must be unique strings, and each card's `columnId` must reference an existing column.
- Positions are normalized per column.
- Imports larger than 2 MB are rejected.
