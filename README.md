```
 █████╗ ███████╗ ██████╗██╗██╗    ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗
██╔══██╗██╔════╝██╔════╝██║██║    ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
███████║███████╗██║     ██║██║    ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
██╔══██║╚════██║██║     ██║██║    ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
██║  ██║███████║╚██████╗██║██║    ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝╚═╝   ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝
```

> **A minimal, browser-based ASCII art editor and wallpaper generator.**  
> No installs. No accounts. Just open and create.

**[→ Open ASCII Studio](https://deviverr.github.io/ASCII-Wallpaper/)**

---

```
┌─────────────────────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░                                               ░  │
│  ░   ╔═══════════╗     ╔═══════════════════╗    ░  │
│  ░   ║           ║     ║  ASCII STUDIO      ║    ░  │
│  ░   ║   PAINT   ║     ║                   ║    ░  │
│  ░   ║           ║     ║  · Paint Editor   ║    ░  │
│  ░   ╚═══════════╝     ║  · Wallpaper Maker║    ░  │
│  ░                     ╚═══════════════════╝    ░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────────────────────┘
```

---

## Features

### ✎ ASCII Paint

```
┌──────┬─────────────────────────────────────┬──────────┐
│ Tool │                                     │  Chars   │
│      │  ╔═══════════╗                      │  . : # @ │
│  ✎   │  ║ draw any  ║                      │  ░ ▒ ▓ █ │
│  ◻   │  ║ character ║                      │  ─ │ ┌ ┘ │
│  ◈   │  ║  on a     ║◄── your canvas       │          │
│  T   │  ║  grid     ║                      │  Shades  │
│  ╲   │  ╚═══════════╝                      │  ██░░    │
│  ▭   │                                     │          │
│  ⬚   │  col:12 row:7    80×30   pencil      │          │
└──────┴─────────────────────────────────────┴──────────┘
```

| Tool | Key | Description |
|------|-----|-------------|
| Pencil | `P` | Draw characters by click or drag |
| Eraser | `E` | Erase cells (right-click also erases) |
| Flood Fill | `F` | Fill a region with the current character |
| Text | `T` | Click to place a cursor and type freely |
| Line | `L` | Draw straight lines (`─` `│` `/` `\`) |
| Rectangle | `R` | Draw box-drawing rectangles (`┌─┐│└─┘`) |
| Select | `S` | Rectangular selection — copy, cut, paste |
| Eyedropper | `I` | Pick a character from the canvas |

**Keyboard shortcuts**

```
Ctrl+Z / Ctrl+Y   undo / redo (50 states)
Ctrl+A            select all
Ctrl+C / X / V    copy / cut / paste
Ctrl+S            export PNG
Ctrl+O            import TXT
+ / -             zoom in / out
G                 toggle grid overlay
Esc               deselect / exit text mode
```

---

### ◈ Wallpaper Maker

Generate high-resolution ASCII wallpapers and export as PNG.

**Resolutions**

```
  HD  1280×720     FHD  1920×1080    QHD  2560×1440
  4K  3840×2160     5K  5120×2880    Mobile  1080×1920
  Square  2048×2048    Custom  any size
```

**Patterns**

```
  Noise      ▒░▓░▒▓░▒░▓    random character field
  Gradient   ░░▒▒▓▓██      density ramp left → right
  Matrix     │║│║│║│║│     vertical falling columns
  Scanlines  ──────────    alternating horizontal rows
  Grid       ┼─┼─┼─┼─┼    box-drawing tile grid
  Border     ╔════════╗    double-line frame
  Wave       ~∿~∿~∿~∿~    sine-wave character stream
  Diagonal   ╲╱╲╱╲╱╲╱╲    striped diagonal bands
  Spiral     @○◉○@○◉○@    outward spiral path
```

**Character Sets**

```
  ASCII      . : - = + * # @ %
  Blocks     ░ ▒ ▓ █ ▄ ▀ ▌ ▐
  Box        ─ │ ┌ ┐ └ ┘ ┼ ╔ ╗
  Dense      @ # % & $ ? ! 8 B M
  Minimal    · · . ° ' `
  Custom     whatever you type
```

---

## Stack

```
  Vanilla HTML · CSS · JavaScript
  No frameworks. No build step. No dependencies.
  Canvas API for rendering + PNG export.
  ~2,500 lines total.
```

---

## Run locally

```bash
git clone https://github.com/deviverr/ASCII-Wallpaper.git
cd ASCII-Wallpaper

# open index.html in a browser — that's it
```

---

## License

MIT

---

```
  made with ░▒▓█ by deviverwork
```
