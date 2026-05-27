<div align="center">

# 🎵 BeatPad

**A self-hosted songwriting workspace for producers and artists.**  
Write lyrics, attach YouTube beats as WAVs, organise songs into albums, and track your creative process — all running locally in Docker.

</div>

---

## What is this?

BeatPad is a full-stack local web app that replaces scattered notes and random files with a proper songwriting dashboard. Paste a YouTube beat URL, and yt-dlp downloads it as a WAV inside Docker — no manual installs needed. Write your lyrics in a focused editor that autosaves everything. Group songs into albums. When you're ready, export a ZIP package to hand off to your engineer.

Everything stays on your machine. No accounts, no cloud, no subscriptions.

---

## Features

### Songs
- Create songs with title, artist, mood, BPM, and key signature
- Choose a **color per song** when creating — change it anytime from the workspace header or the sidebar
- **Lyrics editor** — distraction-free, fills the full screen, autosaves every 700ms
  - Undo / redo (Ctrl+Z / Ctrl+Y) with up to 150-step history
  - Text zoom controls (75% → 200%)
  - Section snippets: `+ Hook`, `+ Verse`, `+ Bridge`
  - Copy to clipboard · Save version snapshots
- Attach a **BandLab project link** per song
- Track song **status**: Draft → In Progress → Finished
- **Confirm prompt** before any deletion — nothing disappears accidentally
- Upload a completed mix and stream it back in the browser

### Beats
- Paste any YouTube URL → yt-dlp downloads the audio as a **WAV** file inside Docker
- Real-time download progress via Server-Sent Events
- Beat file is attached to the song and streamable in the browser
- Swap the beat at any time by detaching and downloading a new one

### Music Player
- Floating pill in the bottom-right corner — collapsed to a 52px play button
- Hover to expand: seek bar, time display, volume slider, mute, close
- Persists across page navigation (beat or mix keeps playing while you browse)

### Albums
- Group songs into albums with cover art (upload your own image)
- **Color per album** — set it from the album card or from inside the album view
- Pin albums to the sidebar for one-click access
- Song status overview: finished / in-progress / draft breakdown at a glance

### Library & Sidebar
- Full library home with album grid and unsorted songs list
- **Search** songs by title, artist, or mood — live filter
- **Pin** individual songs to the sidebar for fast access
- Library stats: total albums, total songs, finished count

### Export
- Package a song as a **ZIP** — lyrics, metadata, beat file, completed mix
- Download the ZIP directly from the browser

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5 |
| Backend | Node.js, Express 4 |
| Database | MySQL 8.0 |
| Beat downloader | [yt-dlp](https://github.com/yt-dlp/yt-dlp) + FFmpeg (inside Docker) |
| Containerisation | Docker Compose |

---

## Requirements

| Tool | Version | Purpose |
|---|---|---|
| **Docker Desktop** | Latest | Runs everything |
| Node.js | 18+ | Only needed for `npm run dev` shortcut |

Docker Desktop: https://www.docker.com/products/docker-desktop

---

## Quick start

```bash
cd wav-downloader
docker compose up --build
```

The first build takes 2–4 minutes (installs Node deps, downloads yt-dlp and FFmpeg inside the images). Subsequent starts are instant.

Then open **http://localhost:5173** in your browser.

### npm shortcuts (requires Node.js)

```bash
npm run dev     # docker compose up --build
npm run down    # docker compose down
npm run logs    # docker compose logs -f
npm run reset   # docker compose down -v  ⚠ deletes the database
```

---

## Services

| Service | URL | Notes |
|---|---|---|
| **App** | http://localhost:5173 | React frontend |
| **API** | http://localhost:5050/api/health | Express backend |
| **Database** | Internal Docker network only | MySQL 8.0 |

---

## Where files live

```
wav-downloader/
├── downloads/      ← WAV beats saved here (host-mounted into Docker)
├── uploads/        ← Cover art + completed song uploads
└── exports/        ← ZIP export packages
```

These folders are bind-mounted into the Docker containers. Files survive container restarts. Your host machine never needs yt-dlp or FFmpeg installed.

To open a beat in your DAW, just navigate to `wav-downloader/downloads/` and drag the WAV into FL Studio, Ableton, BandLab, Audacity, etc.

---

## Project structure

```
wav-downloader/
├── docker-compose.yml
├── package.json              ← root npm scripts (docker shortcuts)
├── database/
│   └── init/
│       └── 001_schema.sql    ← auto-runs on first MySQL start
├── server/                   ← Express API
│   ├── Dockerfile            ← Node + yt-dlp + FFmpeg
│   ├── index.js
│   ├── db/
│   │   ├── connection.js
│   │   └── migrations.js
│   ├── routes/               ← songs, albums, beats, exports, health…
│   ├── services/             ← business logic
│   └── utils/
├── client/                   ← React + Vite frontend
│   ├── Dockerfile
│   ├── vite.config.js        ← proxies /api → server:5050
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       ├── components/       ← 40+ components
│       └── styles/
│           └── app.css
├── downloads/                ← WAV files (gitignored, .gitkeep tracks dir)
├── uploads/                  ← Uploaded files (gitignored)
└── exports/                  ← ZIP exports (gitignored)
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server + yt-dlp + FFmpeg + DB status |
| `GET` | `/api/songs` | List all songs |
| `GET` | `/api/songs/:id` | Full song with beats, versions, activity |
| `POST` | `/api/songs` | Create song |
| `PATCH` | `/api/songs/:id` | Update fields (title, lyrics, status, …) |
| `DELETE` | `/api/songs/:id` | Delete song |
| `POST` | `/api/songs/:id/versions` | Save lyric version snapshot |
| `POST` | `/api/songs/:id/download-beat` | Start yt-dlp beat download → `{ jobId }` |
| `GET` | `/api/download-jobs/:jobId/events` | SSE stream of download progress |
| `GET` | `/api/beats/:id/stream` | Stream WAV to browser |
| `GET` | `/api/beats/:id/download` | Download WAV as attachment |
| `GET` | `/api/albums` | List all albums |
| `POST` | `/api/albums` | Create album |
| `PATCH` | `/api/albums/:id` | Rename / update album |
| `DELETE` | `/api/albums/:id` | Delete album (songs kept) |
| `POST` | `/api/albums/:id/cover` | Upload album cover art |
| `GET` | `/api/albums/:id/cover` | Serve cover image |
| `POST` | `/api/songs/:id/export` | Build + return ZIP package |

---

## Troubleshooting

**Port already in use**
Stop whatever is using port 5173 or 5050, or edit the ports in `docker-compose.yml`.

**MySQL won't start**
```bash
docker compose down -v
docker compose up --build
```
The `-v` flag removes old volumes so MySQL can re-initialise cleanly.

**Beat download fails — "Video unavailable"**
The video may be private, deleted, age-restricted, or region-locked. Try a different URL.

**yt-dlp not found inside the container**
Force a fresh image build:
```bash
docker compose down
docker compose up --build
```

**Downloads folder is empty after a download**
Check `wav-downloader/downloads/` on your host — not your system Downloads folder. The Docker volume mounts directly into this project directory.

**Backend unreachable**
- Confirm Docker Desktop is running
- Run `docker compose logs server` to see error output

---

## Notes

- **Local only** — do not expose Docker ports on a public network; there is no authentication
- **Database** persists in a Docker named volume (`beatpad_mysql_data`) across restarts
- **Media files** persist on your host in `downloads/`, `uploads/`, and `exports/`
- yt-dlp and FFmpeg are installed **inside Docker** — your host machine does not need either
