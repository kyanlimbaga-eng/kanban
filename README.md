# Flowboard

A clean, local-first Kanban board built with React, TypeScript, and Tailwind CSS. Flowboard keeps the whole board in your browser, so you can plan work without an account, backend, or network round-trips.

## Features

- Default columns: **To Do**, **In Progress**, **Review**, and **Done**
- Add, rename, delete, and drag-to-reorder columns
- Add, edit, and delete cards with a title, description, priority, due date, labels, and assignee
- Drag and drop cards between columns or reorder them within a column
- Click any card to open a detail editor
- Manage labels globally from Settings: rename, merge, delete, and view usage counts
- Search plus label and priority filters that compose together
- Overdue and due-today indicators
- Local persistence with `localStorage`
- JSON export and validated JSON import
- Persisted light/dark theme
- Responsive layout with fluid desktop columns and horizontally scrolling swipeable columns on small screens
- Keyboard-accessible drag and drop

A small starter board is added on first run so there is something to explore. Delete those cards or import your own board whenever you like.

## Tech stack

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/)
- [@dnd-kit](https://dndkit.com/) for drag and drop
- [Zustand](https://zustand.docs.pmnd.rs/) with the `persist` middleware for state
- [SQLite Wasm](https://sqlite.org/wasm/doc/trunk/index.md) for browser-side persistence
- [date-fns](https://date-fns.org/) for date handling
- [nanoid](https://github.com/ai/nanoid) for ids

## Getting started

### Requirements

- Node.js 20.19+ or 22.12+ (required by Vite 8)
- npm 10+

### Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

### Scripts

| Command           | Description                                  |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with hot reload    |
| `npm run build`   | Type-check and build the production bundle   |
| `npm run preview` | Serve the production build locally           |
| `npm run lint`    | Run oxlint                                   |

## Using Flowboard

- **Cards:** click a card (or its pencil button) to edit it. Use **Add card** at the bottom of a column for a new one. Delete from inside the card editor.
- **Dragging:** drag cards between columns or onto another card to reorder. Drag the grip handle in a column header to reorder columns. On touch screens, press and hold a card for a moment before moving it.
- **Keyboard:** focus a card and press `Enter` to edit it. Press `Space` to pick it up, use the arrow keys to move, press `Space` to drop, or `Escape` to cancel. Column handles work the same way.
- **Filters:** search matches card titles, descriptions, labels, and assignees. Label and priority filters combine with search. The result count appears in the toolbar.
- **Dark mode:** use the sun/moon button in the header. The choice is remembered.
- **Export/import:** **Export** downloads the current board as JSON. **Import** validates a file and asks for confirmation before replacing the current board. Prefer exporting a backup first.

## Persistence

There is no backend. Flowboard stores data in the browser using SQLite (WebAssembly) with a `localStorage` fallback:

- `flowboard.board` — columns and cards
- `flowboard.ui` — selected theme

SQLite is initialized asynchronously, so the app shows a short loading screen on first render. If SQLite cannot initialize (unsupported browser, private mode, storage quota, or WASM load failure), Flowboard falls back to `localStorage` automatically.

Clearing site data for the app resets it to the starter board. Because storage is per-browser and per-origin, boards are not shared across devices. Use export/import to move data.

## Project structure

```
src/
├─ components/
│  ├─ ui/                 # Buttons, inputs, modal, toast, icons, etc.
│  ├─ AppHeader.tsx
│  ├─ Board.tsx           # Drag context, filtering, dialogs, import/export
│  ├─ BoardEmptyState.tsx
│  ├─ Card.tsx            # Sortable card and drag preview
│  ├─ CardModal.tsx
│  ├─ Column.tsx          # Sortable column, card droppable, empty states
│  ├─ ColumnModal.tsx
│  └─ FilterBar.tsx
├─ store/
│  ├─ boardStore.ts       # Persisted board data and all mutations
│  └─ uiStore.ts          # Persisted theme and session filters
├─ types/index.ts
├─ utils/                 # Dates, filtering, labels, import validation, helpers
├─ App.tsx
├─ index.css
└─ main.tsx
```

## Deployment

The app is a static single-page site. Build output is written to `dist/`.

### Vercel

1. Push the project to a Git repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite automatically. Confirm:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
4. Deploy. No environment variables are required.

You can also deploy from the CLI:

```bash
npx vercel --prod
```

### Netlify

1. Push the project to a Git repository.
2. In Netlify, choose **Add new site → Import an existing project**.
3. Set:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Deploy. If Netlify uses an older Node version, set `NODE_VERSION=22` in the site environment variables.

Or deploy the built output directly:

```bash
npm run build
npx netlify deploy --prod --dir=dist
```

No SPA redirect is needed for this app because it has no client-side router. If you add routing later, configure a catch-all rewrite to `/index.html`.

## Import format

Import accepts a Flowboard export (the object contains a `board` key) or a raw board object. Both of these shapes work:

```json
{
  "columns": [{ "id": "todo", "title": "To Do", "order": 0 }],
  "cards": [
    {
      "id": "card-1",
      "columnId": "todo",
      "title": "First task",
      "description": "",
      "priority": "medium",
      "dueDate": null,
      "labels": ["Example"],
      "assignee": "Alex",
      "position": 0
    }
  ]
}
```

Notes:

- `priority` must be `low`, `medium`, or `high`.
- `dueDate` is either `null` or a valid `YYYY-MM-DD` date.
- Column and card ids must be unique strings, and every card's `columnId` must reference an existing column.
- Positions are normalized on import per column.
- Imports larger than 2 MB are rejected.
