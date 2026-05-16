# Vacation Planner - Handover

## Doel
Dit document beschrijft de actuele staat van de app zodat een nieuwe chat direct kan doorgaan zonder opnieuw uitzoekwerk.

## Huidige stack
- Platform: PWA (iPhone via Safari → **Zet op beginscherm**)
- Tech: HTML, CSS, JavaScript (geen build tool)
- Hosting: [GitHub Pages](https://pages.github.com/) via repo [naomibuuren010/Vacation-Planner](https://github.com/naomibuuren010/Vacation-Planner) (`main`, root)
- Data-opslag: `localStorage` key `vacation_planner_v1` (per device + per origin)
- Checklist (apart): `vacation_planner_checklist_v1`
- Kaart: Leaflet + satellietlaag (`Esri World Imagery`) + labels overlay (`CARTO dark_only_labels`)
- Weer: Open-Meteo in hero (eerste routepunt met coördinaten van geselecteerd land)
- Locatie:
  - coords uit Google Maps-links parsen
  - fallback backfill uit bestaande items
  - geocoding fallback via Nominatim voor plekken zonder coords

## Live URL
- https://naomibuuren010.github.io/Vacation-Planner/

## Huidige versie (belangrijk)
- **v58**
- `app.js`: `APP_VERSION = 58`
- `index.html`: `app.js?v=58`
- `sw.js`: `CACHE_NAME = vacation-planner-v58`, `app.js?v=58` in `ASSETS`

Versie staat ook in de badge rechtsboven (`online v58` / `offline v58`).

## Recente wijzigingen (v42 -> v58)
- **Route + budget onder de kaart** (`renderMapInsights`)
  - Route: stops, km (automatisch uit polyline of handmatig via **KM bewerken** → `routeKmManual`)
  - Budget: donut + legenda per land, bewerkbaar via prompts (`budgetHotels`, `budgetActivities`, `budgetTransport`, `budgetFoodDrink`, `budgetOther`)
- **Hero**: transparant weerwidget; eigen achtergrondfoto per land
- **Reis checklist** naast landen beheren (10 items, eigen localStorage)
  - Inclusief visum, contant geld, budget controleren, sim/eSIM
- **Data tussen devices**
  - **Export data** / **Import data** (JSON) — aanbevolen route pc ↔ iPhone
  - **Sync-link** (`#sync=...`) nog beschikbaar; beperkt door URL-lengte bij veel foto’s
  - **Cloud sync** (jsonblob) UI-knop uitgeschakeld met uitleg (CORS/write vanaf iPhone)
- **Kaart/route fixes**: geocoding ook bij één pin; landmark-backfill (o.a. Big Ben)
- **Activiteiten v58**: optioneel `bookingLink` (GetYourGuide/andere boekings-URL)
  - Zichtbaar in lijst + knop **Boeking**; kaart-pin opent boekingslink vóór Maps-link
- **Eerdere basis (v37–v41)** nog van kracht: thumbnails, hotelprijs/website, IJsland-seed, mobiel land-brede activiteiten/hotels, `syncSelectedPlaceWithCountry`

## Kernfunctionaliteit
- Landen beheren (add/edit/delete)
- Route per land met steden/gebieden, `stayDays`, sortering op `sortOrder`
- Kaart met route-lijn + genummerde markers; tik op routenummer = plek kiezen
- Activiteiten/hotels met:
  - adres
  - Google Maps-link → pin/kaart
  - activiteiten: **boekingslink** (GetYourGuide e.d.)
  - foto (URL of upload)
  - hotels: website + prijsveld
- Hero per land met eigen achtergrondfoto + weer
- Instellingen: export/import, sync-link, checklist

## Data model (actueel)
- **Country:** `id`, `name`, `heroImageUrl`, `routeKmManual?`, `budgetHotels`, `budgetActivities`, `budgetTransport`, `budgetFoodDrink`, `budgetOther` (getallen, default 0)
- **Place:** `id`, `countryId`, `type`, `name`, `latitude?`, `longitude?`, `stayDays?`, `sortOrder`
- **Activity:** `id`, `placeId`, `title`, `address`, `mapsLink`, `bookingLink`, `photoUrl`, `latitude`, `longitude`, `sortOrder`, `notes`, `date`
- **Hotel:** `id`, `placeId`, `name`, `address`, `mapsLink`, `websiteUrl`, `photoUrl`, `priceLabel`, `latitude`, `longitude`, `sortOrder`
- **Checklist** (los): object `{ [itemId]: boolean }` in `vacation_planner_checklist_v1`

## iPhone / PWA opnieuw zetten
1. Safari → https://naomibuuren010.github.io/Vacation-Planner/
2. Deel-knop → **Zet op beginscherm**
3. Data overzetten: op pc **Export data**, op iPhone app openen → **Import data** (zelfde JSON)
4. Bij oude versie: pagina verversen of icoon verwijderen en opnieuw toevoegen; controleer badge **v58**

## Bekende aandachtspunten
- Geen betrouwbare cloud-sync: data blijft lokaal per device/origin tenzij export/import of sync-link
- iPhone en desktop kunnen verschillende data tonen → export/import gebruiken
- PWA/service worker cache kan achterlopen → versie bump op alle 3 plekken + hard refresh
- Sync-link faalt bij zeer grote exports (veel base64-foto’s)
- `normalizeData` vult ontbrekende budget-/bookingvelden met defaults

## Belangrijke bestanden
- `app.js`: state, rendering, data-normalisatie, seed (IJsland), map, budget/route insights, checklist, SW-registratie
- `styles.css`: dashboard, map insights, checklist, mobiel gedrag
- `index.html`: layout + scriptversie
- `sw.js`: cache policy/versioning
- `manifest.webmanifest`, `icon.svg`: PWA assets

## Deploy checklist
1. Code aanpassen
2. Bij release altijd versie bump in:
   - `app.js` → `APP_VERSION`
   - `index.html` → `app.js?v=...`
   - `sw.js` → `CACHE_NAME` + `ASSETS app.js?v=...`
3. Push:

```powershell
cd "C:\Users\Eigenaar\Documents\Cursor\Apps\Vacation planner"
git add -A
git commit -m "..."
git push
```

4. Op iPhone PWA heropenen / verversen om nieuwe SW over te nemen (badge moet nieuwe versie tonen).

## Snelle context voor nieuwe chat (copy/paste)
We werken aan de Vacation Planner PWA (HTML/CSS/JS) op GitHub Pages: https://naomibuuren010.github.io/Vacation-Planner/ (repo: https://github.com/naomibuuren010/Vacation-Planner). Actuele versie is **v58** (`app.js`, `index.html`, `sw.js` gesynchroniseerd). Kern: landen → route-plekken → activiteiten/hotels met map-pins, foto's, hotelprijzen/website, activiteit-boekingslinks (GetYourGuide). Onder de kaart: route-km (auto/handmatig) + budget-donut (5 categorieën). Reis-checklist (10 items, apart localStorage). Data sync tussen devices: **Export/Import JSON** (aanbevolen); cloud-sync UI uit; sync-link optioneel. iPhone: PWA via Safari “Zet op beginscherm”. Zie `HANDOVER.md` voor data model en deployregels.
