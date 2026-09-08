# Piste

Onverharde beklimmingen in Europa die in een weekend passen. Gesorteerd op rijtijd vanaf jouw vertrekpunt, met oordelen van rijders die er geweest zijn en een bron bij elke bewering.

- `index.html`, `styles.css`, `app.js` — de site, geen build-stap. MapLibre GL voor de kaart en het 3D-terrein.
- `data/climbs.json` — 35 beklimmingen. `data/logistics.json` — logistiekdossiers per klim. `data/origins.json` — vertrekpunten.
- `research/` — briefing, verificatierapporten en ruwe dossiers van de onderzoeksronde. Provenance, geen runtime.
- `tools/apply-research.cjs` — voegt `research/logi/*.json` samen in `data/logistics.json` en past gecontroleerde fixes uit `research/verify/*.json` toe.
- `archive/` — de oorspronkelijke single-file versie.

Lokaal bekijken: `python -m http.server 8765` in deze map, dan http://localhost:8765/.

Redactionele regels staan in `research/BRIEF.md`. Kort: bronnen boven meningen, citaten verbatim en onder de vijftien woorden, tegenspraak blijft staan, "onbevestigd" is een geldige waarde, oordelen zijn geijkt op 650b × 55 mm.
