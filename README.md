# BOSS — Business Owner Strategic System

Scroll-driven marketing site for BOSS. Static HTML/CSS/JS (GSAP, ScrollTrigger, Three.js and Lenis from CDNs) — no build step.

## Structure

| Path | What it is |
|---|---|
| `index.html` | All sections and content |
| `css/style.css`, `css/sections.css` | Theme, glass, layout, responsive rules |
| `js/intro.js` | 3D boot intro (wires → reactor) |
| `js/scene.js` | WebGL background driven by scroll |
| `js/main.js` | Scroll choreography, functions explorer, dashboard, demo form |
| `assets/boss-logo.png` | The logo (`boss-logo.svg` is a fallback) |
| `api/demo-request.php`, `data/` | Demo-form backend for local XAMPP only (not deployed to Vercel) |

## Demo form

- **Vercel / any static host:** set `data-formspree="<your form ID>"` on `#demoForm` in `index.html`. Requests are emailed by Formspree.
- **XAMPP:** leave `data-formspree` empty; requests are saved to `data/demo-requests.csv` by the PHP script.

## Deploy to Vercel

1. Push this repo to GitHub.
2. On vercel.com → **Add New… → Project** → import the repo.
3. Framework preset: **Other**. Leave build command and output directory empty. Deploy.

Every push to the main branch redeploys automatically.

## Local

Serve the folder with XAMPP (`http://localhost/boss_wire/`) or any static server.
