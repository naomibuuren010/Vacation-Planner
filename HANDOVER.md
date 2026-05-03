# Vacation Planner - Handover

## Doel
Dit document beschrijft wat er gebouwd is, waar het draait, en hoe je verder werkt. Gebruik het in nieuwe chats om snel context te geven.

## Huidige stack
- Platform: PWA (Safari op iPhone → **Zet op beginscherm**)
- Tech: HTML, CSS, JavaScript (geen build tool)
- **Hosting (primair):** [GitHub Pages](https://pages.github.com/) — repo [naomibuuren010/Vacation-Planner](https://github.com/naomibuuren010/Vacation-Planner), bron `main` + map `/`
- **Oude hosting (optioneel):** Netlify Drop-URL kan verouderd zijn; nieuwe releases gaan via **git push**
- Data: `localStorage` onder key `vacation_planner_v1` (per browser / per origin; **GitHub Pages-URL ≠ Netlify-URL** = aparte data)
- Kaart: Leaflet; tegels **CARTO Positron** met **OSM-fallback** bij tile-fouten
- Locatie: alleen **parsen van coördinaten uit Google Maps-links** (geen Geocoding API, geen billing)

## Live URL’s
- **GitHub Pages:** https://naomibuuren010.github.io/Vacation-Planner/
- **Netlify (legacy, indien nog gebruikt):** https://deft-duckanoo-568f9b.netlify.app/

## Huidige versie
- UI-badge: **v21** (`online v21` / `offline v21`)
- `index.html`: `app.js?v=21`
- `sw.js`: cache `vacation-planner-v21`, `app.js?v=21` in `ASSETS`
- Bij grotere wijzigingen: **versie in `app.js`, `index.html` en `sw.js` gelijk hogen** + gebruikers **harde refresh** / PWA opnieuw openen

## Functionaliteit (kern)
- **Landen:** toevoegen, bewerken, verwijderen
- **Plaatsen (route):** één lijst met volgorde `sortOrder` (nieuw onderaan; niet A–Z). Types `city` | `area`. Optioneel **`stayDays`** (klein boven naam); bewerken via dialoog na naam
- **Activiteiten** (per gekozen plek): titel, adres, **Google Maps-link** (pin + klik op marker opent link), optionele **foto** (URL of upload)
- **Hotels:** adres, **Google Maps-link** (zoals activiteiten: meta `maps-link`, pin, marker → Maps), apart veld **`websiteUrl`** (klikbare site in de lijst)
- **Layout:** verticale kolom + **trip-cards** (plaatsen / activiteiten / hotels); bij **meerdere landen** iets nadrukker styling (`multi-land`)
- **Kaart:** pins plekken, activiteiten, hotels; handmatige pin na `Pin op kaart`
- **iOS/PWA:** invoer veelal via native `prompt()` waar van toepassing (stabieler toetsenbord)
- **Dataherstel bij laden:** ontbrekende `countryId`-landen worden aangevuld; wees-activiteiten/hotels worden waar mogelijk opnieuw gekoppeld (o.a. oude pleknamen uit JSON + adreshint). **Seed** alleen als **alles** leeg is (`countries`, `places`, `activities`, `hotels`), om dubbele Thailand-seed te voorkomen

## Bekende beperkingen
- Geen cloud-sync; data blijft lokaal per apparaat en per site-URL
- Niet elke Maps-link bevat coördinaten → handmatige pin
- Offline: UI werkt; kaarttegels afhankelijk van cache/netwerk

## Belangrijke bestanden
| Bestand | Rol |
|--------|-----|
| `index.html` | Layout, trip-stack, dialogs, script-`?v=` |
| `styles.css` | Styling, trip-cards, lijst/layout |
| `app.js` | Data, CRUD, kaart, normalisatie, herstel, seed |
| `sw.js` | Cache-versie en asset-lijst |
| `manifest.webmanifest` | PWA-manifest |
| `icon.svg` | Icoon |
| `GITHUB-SETUP.md` | Repo aanmaken, Pages (handmatig + script) |
| `scripts/enable-github-pages.ps1` | Pages inschakelen via GitHub API (`$env:GITHUB_TOKEN`) |

Ook in de repo: **legacy Swift**-bestanden (niet nodig voor de live PWA).

## Deploy (GitHub Pages)
1. Wijzig code lokaal.
2. Verhoog indien nodig **dezelfde** versie in `app.js` (badge + `registerServiceWorker`), `index.html` (`app.js?v=`), `sw.js` (`CACHE_NAME` + `app.js?v=` in `ASSETS`).
3. In projectmap:

```powershell
cd "C:\Users\Eigenaar\Documents\Cursor\Apps\Vacation planner"
git add -A
git status
git commit -m "Korte beschrijving"
git push
```

4. GitHub Pages ververst na push (meestal binnen ~1 minuut).
5. Op iPhone: site in Safari openen, eventueel verversen; bij grote SW-wijzigingen PWA opnieuw “vastzetten” als nodig.

## Data model (samenvatting)
- **Country:** `id`, `name`
- **Place:** `id`, `countryId`, `type`, `name`, `latitude?`, `longitude?`, `sortOrder`, `stayDays?` (1–366 of weggelaten)
- **Activity:** `id`, `placeId`, `title`, `notes`, `date`, `address`, `mapsLink`, `photoUrl`, `latitude`, `longitude`, `sortOrder`
- **Hotel:** `id`, `placeId`, `name`, `address`, `mapsLink`, `websiteUrl`, `latitude`, `longitude`, `sortOrder`

## Testen (maps → pin)
1. Activiteit met Maps-URL met coördinaten → pin zichtbaar; klik marker → link opent.
2. Hotel:zelfde voor Maps-pin; **website** opent vanuit de lijstregel, niet vanuit de korte meta.
3. Link zonder coördinaten → opslaan lukt; handmatige pin mogelijk.

## Snelle context voor nieuwe chat (copy/paste)
We werken aan de Vacation Planner PWA (HTML/CSS/JS), primair op **GitHub Pages**: https://naomibuuren010.github.io/Vacation-Planner/ — repo https://github.com/naomibuuren010/Vacation-Planner . Versie **v21** (`app.js` / `index.html` / `sw.js`). Structuur: landen → plaatsen (route + dagen + sortOrder) → activiteiten/hotels per plek. Hotels: `mapsLink` voor kaart/pin, `websiteUrl` voor site-link in UI. Data in `localStorage`. Deploy: `git push`. Zie `HANDOVER.md` voor details.
