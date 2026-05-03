# Vacation Planner - Handover

## Doel
Dit document houdt bij wat er gebouwd is, wat live staat, en wat de volgende stappen zijn.
Gebruik dit in nieuwe chats om snel context te geven.

## Huidige stack
- Platform: PWA (web app, iPhone homescreen via Safari)
- Tech: HTML, CSS, JavaScript (zonder build tool)
- Hosting: Netlify Drop
- Data-opslag: `localStorage` (offline op toestel/browser)
- Kaart: Leaflet + OpenStreetMap tiles
- Locatie-resolutie: Google Maps link parsing (geen API key, geen billing)

## Live URL
- Productie: [https://deft-duckanoo-568f9b.netlify.app/](https://deft-duckanoo-568f9b.netlify.app/)

## Huidige versie
- App versie-indicator in UI: `v11` (rechtsboven als `online v11` / `offline v11`)
- Cache key in service worker: `vacation-planner-v11`

## Functionaliteit die nu werkt
- Landen beheren
  - Toevoegen, bewerken, verwijderen
- Steden/Gebieden beheren binnen gekozen land
  - Toevoegen, bewerken, verwijderen
- Activiteiten beheren binnen gekozen plek
  - Toevoegen, bewerken, verwijderen
  - Extra velden: `address`, `mapsLink`
  - Auto pin via maps-link parsing
- Hotels beheren binnen gekozen plek
  - Toevoegen, bewerken, verwijderen
  - Extra velden: `address`, `mapsLink`
  - Auto pin via maps-link parsing
- Kaartweergave
  - Pins voor plekken (stad/gebied) met opgeslagen locatie
  - Pins voor activiteiten met opgeslagen locatie
  - Pins voor hotels met opgeslagen locatie
- Pin-flow op kaart
  - Bij plek: knop `Pin op kaart` -> tik op kaart om pin op te slaan
  - Bij activiteit: knop `Pin op kaart` -> tik op kaart om pin op te slaan
  - Bij hotel: knop `Pin op kaart` -> tik op kaart om pin op te slaan
- Automatische locatie-resolutie
  - Eerst parsing van Google Maps links (coördinaten in URL)
  - Als parsing faalt: item wordt wel opgeslagen, handmatige pin mogelijk
- iPhone/PWA invoerfix
  - Op iOS/standalone wordt invoer via native `prompt()` afgehandeld (stabiel toetsenbord/focus)
- Annuleer-flow werkt
  - Geen blokkade meer door HTML form-validatie

## Bekende UX-keuzes / beperkingen
- Kaartlabels komen van OpenStreetMap, niet geforceerd Nederlands.
- Zonder internet werken data en UI offline, maar kaarttegels kunnen beperkt zijn als nog niet gecached.
- Data staat lokaal in browser/app-opslag; geen cloud sync.
- Niet elke Google Maps link bevat bruikbare coördinaten; dan is handmatige pin nodig.

## Belangrijke bestanden
- `index.html` - app layout + scripts/css includes
- `styles.css` - styling
- `app.js` - volledige app-logica, data, CRUD, kaart en pin-flow
- `sw.js` - service worker caching
- `manifest.webmanifest` - PWA manifest
- `icon.svg` - app icoon

## Deploy procedure (Netlify Drop)
1. Upload gewijzigde bestanden (of hele zip) in Netlify Deploys.
2. Hard refresh op desktop: `Ctrl + F5`.
3. Controleer versie rechtsboven (bijv. `online v11`).
4. Op iPhone bij grote updates:
   - Oude homescreen app verwijderen
   - Site 1x in Safari openen
   - Opnieuw `Zet op beginscherm`

## Data model (huidig, impliciet in JS objecten)
- Country
  - `id`, `name`
- Place
  - `id`, `countryId`, `type` (`city|area`), `name`, `latitude?`, `longitude?`
- Activity
  - `id`, `placeId`, `title`, `notes`, `date`, `address?`, `mapsLink?`, `latitude?`, `longitude?`
- Hotel
  - `id`, `placeId`, `name`, `address?`, `mapsLink?`, `latitude?`, `longitude?`

## Testprocedure maps-link -> pin
1. Voeg activiteit toe met Google Maps link die coördinaten bevat -> pin moet direct verschijnen.
2. Voeg hotel toe met Google Maps link die coördinaten bevat -> pin moet direct verschijnen.
3. Gebruik link zonder bruikbare coördinaten -> item wordt opgeslagen zonder pin.
4. Zet daarna handmatig pin via `Pin op kaart` -> pin verschijnt.

## Snelle context voor nieuwe chat (copy/paste)
We bouwen een Vacation Planner PWA (HTML/CSS/JS) op Netlify:
- URL: https://deft-duckanoo-568f9b.netlify.app/
- Huidige versie: v11
- Structuur: landen -> steden/gebieden -> activiteiten/hotels
- Kaart via Leaflet met pinnen voor plekken, activiteiten en hotels
- Auto-pin via maps-link parsing (geen API key nodig)
- iPhone input gebruikt native prompt om focusproblemen te vermijden
- Belangrijkste files: index.html, styles.css, app.js, sw.js

Vraag: ga verder vanaf v11 en behoud huidige functionaliteit.

