# PISTE research brief (for research agents)

PISTE is a Dutch-language site listing 35 unpaved (gravel) climbs in Europe for weekend trips from NL/BE.
Data lives in `data/climbs.json` (array, key `id`) and `data/logistics.json` (object keyed by climb id).

## Editorial rules — non-negotiable
1. **Sources over opinions.** Every claim carries a URL where a real person or an official body states it. No URL = `"u": null`, which renders as "onbevestigd". Never invent an address, price, opening day, phone number or fact that is not on the source page.
2. **Quotes are verbatim, under 15 words, in the original language**, with a Dutch gist in `tr` and the exact page URL in `url`. Never paraphrase a quote into something stronger than the original. Only quote real riders/visitors/officials, not marketing copy.
3. **Contradictions stay visible.** If sources disagree, record both in `gap` (e.g. car-free days differ between municipality and blogs).
4. **Be honest about coverage.** If most sources are tour operators or hiking reports rather than gravel riders, say so in `gap`.
5. **Tyre calibration.** Verdicts are calibrated on a gravel bike with 650b × 55 mm tyres. If a source says "MTB", record what tyre width they rode if stated.
6. **Dutch, natural.** Facts (`t`) are written in natural Dutch, not translated English. Keep place names in original language.
7. Prefer first-hand sources: Komoot tour descriptions and comments, Strava/RideWithGPS/Wikiloc route notes, climb sites (climbfinder, quaeldich, cycling-challenge, pjammcycling, cols-cyclisme), forums (singletrackworld, bikepacking.com, tweakers/fietsforum), gemeente/comune/commune sites, tourist offices, refuge sites, Chargemap, OpenStreetMap-derived sites for water points (e.g. refill sites), official park sites for access rules.

## Logistics dossier schema (one per climb, `research/logi/<id>.json`)
```json
{
 "base":   [{"t":"…","u":"https://…"}],   // which village(s) to base in and why; where the climb starts
 "sleep":  [{"t":"…","u":"…"}],           // named hotels/gîtes/campsites with address if on source
 "park":   [{"t":"…","u":"…"}],           // where to park a car; EV charging (name Chargemap/other source or u:null)
 "water":  [{"t":"…","u":"…"}],           // fountains, refuges, last tap before the top
 "food":   [{"t":"…","u":"…"}],           // shops/restaurants/refuges; opening caveats
 "season": [{"t":"…","u":"…"}],           // snow-free window, road closures, car-free days, access rules, tolls
 "gpx":    [{"t":"Komoot-tour van X, 48 km, 1.700 m","u":"https://www.komoot.com/tour/…"}], // 1–3 downloadable/viewable tracks; label the platform and who made it
 "quotes": [{"who":"Fietser, Komoot juni 2024","q":"…","tr":"…","url":"…"}],  // 1–3 quotes about logistics/practicalities
 "gap":    "…"                             // where coverage is thin or sources contradict; "" if none
}
```
Aim for 2–4 facts per section, 12–25 facts total, at least 75% with a URL. Each URL must have been opened and read by you. Write the JSON with a JSON validator pass (node -e or python -m json.tool) before finishing.

## Fetching
Use WebFetch first. If a site blocks (403/429), use headless Playwright from Python (already installed):
```
python - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128 Safari/537.36")
    pg.goto("URL", wait_until="domcontentloaded", timeout=30000); pg.wait_for_timeout(1500)
    print(pg.inner_text("body")[:6000]); b.close()
PY
```
Do not spend more than ~3 attempts on one URL; mark it unreachable and move on.
