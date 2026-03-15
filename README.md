# Upload2GDrive

Electron + React GUI for uploading large files/folders to Google Drive via `rclone`.

## Features

- Move upload operation (`rclone move`) to `gdrive:Videos` by default.
- Supports selecting multiple files and/or whole folders.
- Native open dialog starts in `~/Downloads` and allows OS-level thumbnail/list switching.
- File filtering in picker and in-app (`All`, `Videos`, `Images`).
- In-app table sorted by largest file size first.
- Multi-select behavior in table supports:
  - click = single select
  - Shift+click = range select
  - Ctrl/Cmd+click = toggle individual selection
- Upload tuning for large transfers:
  - `--drive-chunk-size=128M`
  - `--transfers=8`
  - `--checkers=16`
  - resumable behavior through rclone retries and session handling
- Live progress/log stream from rclone JSON stats.

## Requirements

- Node.js 18+
- `rclone` in `PATH`
- Existing rclone remote named `gdrive`

## Run

```bash
npm install
npm run dev
```

## Build renderer assets

```bash
npm run build
```
