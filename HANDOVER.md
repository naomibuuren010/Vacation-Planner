# Vacation Planner - Handover

## Doel
Dit document beschrijft de actuele staat van de app zodat een nieuwe chat direct kan doorgaan zonder opnieuw uitzoekwerk.

## Huidige stack
- Platform: PWA (iPhone via Safari -> **Zet op beginscherm**)
- Tech: HTML, CSS, JavaScript (geen build tool)
- Hosting: [GitHub Pages](https://pages.github.com/) via repo [naomibuuren010/Vacation-Planner](https://github.com/naomibuuren010/Vacation-Planner) (`main`, root)
- Data-opslag: `localStorage` key `vacation_planner_v1` (per device + per origin)
- Kaart: Leaflet + satellietlaag (`Esri World Imagery`) + labels overlay (`CARTO dark_only_labels`)
- Locatie:
  - coords uit Google Maps-links parsen
  - fallback backfill uit bestaande items
  - geocoding fallback via Nominatim voor plekken zonder coords

## Live URL
- https://naomibuuren010.github.io/Vacation-Planner/

## Huidige versie (belangrijk)
- **v41**
- `app.js`: `APP_VERSION = 41`
- `index.html`: `app.js?v=41`
- `sw.js`: `CACHE_NAME = vacation-planner-v41`, `app.js?v=41` in `ASSETS`

## Recente wijzigingen (v37 -> v41)
- **v37**
  - Thumbnails in activiteiten- en hotellijst
  - Hotel `photoUrl` + `priceLabel` toegevoegd aan data + promptflow
  - Hotelprijs zichtbaar in lijst
- **v38**
  - Mobiele/PWA layout verbeterd (safe-area, map hoogte met `dvh`, scrollbare chips/nav, betere touch targets)
- **v39**
  - IJsland toegevoegd aan seed
  - Eenmalige merge voor bestaande installs zonder IJsland (`ICELAND_SAMPLE_LS_KEY`)
- **v40**
  - iPhone fix: landwissel laat `selectedPlaceId` niet onnodig leeglopen
  - Mobiele lijst-CSS beperkt tot activiteiten/hotels (niet alle lijsten)
- **v41**
  - Robuuste sync: gekozen plek moet bij geselecteerd land horen (`syncSelectedPlaceWithCountry`)
  - Mobiel (`<=960px`): activiteiten/hotels tonen alle items van geselecteerd land (niet alleen 1 stop)
  - Resize listener (debounced) om mobiel/desktop render consistent te houden

## Kernfunctionaliteit
- Landen beheren (add/edit/delete)
- Route per land met steden/gebieden, `stayDays`, sortering op `sortOrder`
- Kaart met route-lijn + genummerde markers
- Activiteiten/hotels met:
  - adres
  - maps-link -> pin/kaart
  - foto (URL of upload)
  - hotels: website + prijsveld
- Hero per land met eigen achtergrondfoto

## Data model (actueel)
- **Country:** `id`, `name`, `heroImageUrl`
- **Place:** `id`, `countryId`, `type`, `name`, `latitude?`, `longitude?`, `stayDays?`, `sortOrder`
- **Activity:** `id`, `placeId`, `title`, `address`, `mapsLink`, `photoUrl`, `latitude`, `longitude`, `sortOrder`, `notes`, `date`
- **Hotel:** `id`, `placeId`, `name`, `address`, `mapsLink`, `websiteUrl`, `photoUrl`, `priceLabel`, `latitude`, `longitude`, `sortOrder`

## Bekende aandachtspunten
- Geen cloud-sync: data blijft lokaal per device/origin
- Daardoor kan iPhone andere data tonen dan desktop (dit is verwacht gedrag)
- PWA cache kan achterlopen: versie bump op alle 3 plekken blijft verplicht
- Als gebruiker "alles kwijt" meldt op iPhone, eerst checken:
  1) juiste land gekozen
  2) in v41 toont mobiel land-breed, desktop stop-specifiek
  3) PWA echt op nieuwste versie (badge + hard refresh / opnieuw openen)

## Belangrijke bestanden
- `app.js`: state, rendering, data-normalisatie, seed, map, SW registratie
- `styles.css`: dashboard + mobiel gedrag
- `index.html`: layout + script versie
- `sw.js`: cache policy/versioning
- `manifest.webmanifest`, `icon.svg`: PWA assets

## Deploy checklist
1. Code aanpassen
2. Indien nodig versie bump in:
   - `app.js` -> `APP_VERSION`
   - `index.html` -> `app.js?v=...`
   - `sw.js` -> `CACHE_NAME` + `ASSETS app.js?v=...`
3. Push:

```powershell
cd "C:\Users\Eigenaar\Documents\Cursor\Apps\Vacation planner"
git add -A
git commit -m "..."
git push
```

4. Op iPhone PWA heropenen / verversen om nieuwe SW over te nemen.

## Snelle context voor nieuwe chat (copy/paste)
We werken aan de Vacation Planner PWA (HTML/CSS/JS) op GitHub Pages: https://naomibuuren010.github.io/Vacation-Planner/ (repo: https://github.com/naomibuuren010/Vacation-Planner). Actuele versie is v41 (`app.js`, `index.html`, `sw.js` gesynchroniseerd). Kern: landen -> route-plekken -> activiteiten/hotels met map-pins, foto's en hotelprijzen. iPhone/PWA gebruikt eigen localStorage (geen cloud-sync), dus device-data kan verschillen. Zie `HANDOVER.md` voor laatste fixes (v37-v41) en deployregels.
