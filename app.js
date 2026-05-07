const STORAGE_KEY = "vacation_planner_v1";
const SYNC_CONFIG_KEY = "vacation_planner_sync_config_v1";
/** Eén keer demo-IJsland toevoegen als het nog ontbreekt (bijv. iPhone vs. andere device). */
const ICELAND_SAMPLE_LS_KEY = "vacation_planner_iceland_sample_merged_v1";
/** Zelfde nummer als in index.html (`app.js?v=`) en sw.js (cache + assets). */
const APP_VERSION = 53;
const CLOUD_SYNC_BASE_URL = "https://jsonblob.com/api/jsonBlob";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&q=80";

const __loaded = loadData();
const state = {
  data: __loaded.data,
  selectedCountryId: null,
  selectedPlaceId: null,
  pendingPinTarget: null,
  locationStatusMessage: "",
  /** Na klik op routenummer: kaart inzoomen op gekozen plek + pins. */
  mapFocusAfterRender: null,
  geocodeInFlight: false,
  weatherRequestToken: 0,
  syncConfig: loadSyncConfig(),
  lastCloudSyncAt: 0,
  syncInFlight: false,
  syncPollTimer: null
};
if (__loaded.repaired) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  } catch {
    /* quota of private mode */
  }
}

let map = null;
let mapMarkers = [];
let routePolyline = null;

const el = {
  main: document.querySelector(".app-main-inner"),
  tripStack: document.getElementById("tripStack"),
  heroTitle: document.getElementById("heroTitle"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  countryChips: document.getElementById("countryChips"),
  heroEditTripBtn: document.getElementById("heroEditTripBtn"),
  heroBgBtn: document.getElementById("heroBgBtn"),
  heroBg: document.getElementById("heroBg"),
  heroShareBtn: document.getElementById("heroShareBtn"),
  heroWeather: document.getElementById("heroWeather"),
  countriesList: document.getElementById("countriesList"),
  placesList: document.getElementById("placesList"),
  activitiesList: document.getElementById("activitiesList"),
  hotelsList: document.getElementById("hotelsList"),
  countryTitle: document.getElementById("countryTitle"),
  activitiesCardTitle: document.getElementById("activitiesCardTitle"),
  hotelsCardTitle: document.getElementById("hotelsCardTitle"),
  activitiesCardHint: document.getElementById("activitiesCardHint"),
  hotelsCardHint: document.getElementById("hotelsCardHint"),
  addCountryBtn: document.getElementById("addCountryBtn"),
  cloudSyncBtn: document.getElementById("cloudSyncBtn"),
  exportDataBtn: document.getElementById("exportDataBtn"),
  importDataBtn: document.getElementById("importDataBtn"),
  createSyncLinkBtn: document.getElementById("createSyncLinkBtn"),
  addCityBtn: document.getElementById("addCityBtn"),
  addAreaBtn: document.getElementById("addAreaBtn"),
  addActivityBtn: document.getElementById("addActivityBtn"),
  addHotelBtn: document.getElementById("addHotelBtn"),
  inputDialog: document.getElementById("inputDialog"),
  inputForm: document.getElementById("inputForm"),
  dialogTitle: document.getElementById("dialogTitle"),
  fieldLabel: document.getElementById("fieldLabel"),
  fieldValue: document.getElementById("fieldValue"),
  cancelBtn: document.getElementById("cancelBtn"),
  photoPicker: document.getElementById("photoPicker"),
  dataImportPicker: document.getElementById("dataImportPicker"),
  offlineBadge: document.getElementById("offlineBadge"),
  placeMap: document.getElementById("placeMap"),
  mapHint: document.getElementById("mapHint"),
  mapRouteSummary: document.getElementById("mapRouteSummary"),
  mapBudgetSummary: document.getElementById("mapBudgetSummary")
};

boot();

function boot() {
  maybeImportDataFromSyncHash();
  if (isAppCompletelyEmpty(state.data)) {
    seedData();
  }
  if (!state.selectedCountryId && state.data.countries.length) {
    state.selectedCountryId = [...state.data.countries].sort(byName("name"))[0].id;
  }
  wireEvents();
  renderAll();
  startCloudSyncPolling();
  void pullCloudSyncIfConnected();
  registerServiceWorker();
}

function wireEvents() {
  if (el.cloudSyncBtn) {
    el.cloudSyncBtn.addEventListener("click", () => {
      window.alert(
        "Cloud sync is tijdelijk uitgeschakeld omdat de browser-opslagdienst write-calls vanaf iPhone blokkeert.\n\n"
        + "Gebruik nu de stabiele route:\n"
        + "1) Op pc: Export data\n"
        + "2) Op iPhone: Import data\n\n"
        + "Dit geeft direct exact dezelfde data op beide apparaten."
      );
    });
  }

  if (el.exportDataBtn) {
    el.exportDataBtn.addEventListener("click", () => {
      try {
        const payload = JSON.stringify(state.data, null, 2);
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vacation-planner-backup-v${APP_VERSION}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch {
        window.alert("Exporteren is mislukt.");
      }
    });
  }

  if (el.importDataBtn && el.dataImportPicker) {
    el.importDataBtn.addEventListener("click", () => {
      el.dataImportPicker.value = "";
      el.dataImportPicker.click();
    });
    el.dataImportPicker.addEventListener("change", async () => {
      const file = el.dataImportPicker.files && el.dataImportPicker.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const normalized = normalizeData(parsed);
        state.data = normalized.data;
        state.selectedCountryId = null;
        state.selectedPlaceId = null;
        state.pendingPinTarget = null;
        state.locationStatusMessage = "Data geïmporteerd vanaf bestand.";
        saveAndRender();
        window.alert("Import gelukt. Je iPhone heeft nu dezelfde data als het bestand.");
      } catch {
        window.alert("Import mislukt. Kies een geldig vacation-planner JSON bestand.");
      }
    });
  }

  if (el.createSyncLinkBtn) {
    el.createSyncLinkBtn.addEventListener("click", async () => {
      try {
        const encoded = encodeDataForSyncLink(state.data);
        const baseUrl = `${window.location.origin}${window.location.pathname}`;
        const syncUrl = `${baseUrl}#sync=${encoded}`;
        if (syncUrl.length > 180000) {
          window.alert("Deze data is te groot voor een sync-link. Verwijder wat foto's of gebruik kortere data.");
          return;
        }
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(syncUrl);
          window.alert("Sync-link gekopieerd. Open deze link op je iPhone om exact dezelfde data over te nemen.");
          return;
        }
        window.prompt("Kopieer deze sync-link en open hem op je iPhone:", syncUrl);
      } catch {
        window.alert("Sync-link maken is mislukt.");
      }
    });
  }

  if (el.heroEditTripBtn) {
    el.heroEditTripBtn.addEventListener("click", () => {
      document.getElementById("card-route")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  if (el.heroBgBtn) {
    el.heroBgBtn.addEventListener("click", () => {
      const country = state.data.countries.find((c) => c.id === state.selectedCountryId);
      if (!country) {
        window.alert("Kies eerst een land (chips hierboven of bij Instellingen).");
        return;
      }
      const cur = typeof country.heroImageUrl === "string" ? country.heroImageUrl : "";
      const v = window.prompt(
        `Achtergrondfoto voor “${country.name}”\n\n`
        + "Plak een https-link naar een foto (jpg/png/webp), bijvoorbeeld van Unsplash.\n"
        + "Leeg maken en OK = standaard tropische foto.\n"
        + "Annuleren = niets wijzigen.",
        cur
      );
      if (v === null) return;
      const t = v.trim();
      if (t && !isSafeHeroImageUrl(t)) {
        window.alert("Alleen http(s)-links naar een afbeelding, of een kleine data:image-foto (base64), zijn toegestaan.");
        return;
      }
      country.heroImageUrl = t;
      saveAndRender();
    });
  }
  if (el.heroShareBtn) {
    el.heroShareBtn.addEventListener("click", () => {
      const country = state.data.countries.find((c) => c.id === state.selectedCountryId);
      const title = country ? `Reis: ${country.name}` : "Vacation Planner";
      if (navigator.share) {
        navigator.share({ title, text: title, url: window.location.href }).catch(() => {});
      } else {
        window.prompt("Kopieer deze link:", window.location.href);
      }
    });
  }

  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-link").forEach((l) => l.classList.remove("is-active"));
      link.classList.add("is-active");
    });
  });

  el.addCountryBtn.addEventListener("click", () => {
    promptInput("Nieuw land", "Landnaam", (value) => {
      state.data.countries.push({
        id: uid(),
        name: value.trim(),
        heroImageUrl: "",
        routeKmManual: null,
        budgetHotels: 0,
        budgetActivities: 0,
        budgetOther: 0
      });
      saveAndRender();
    });
  });

  el.addCityBtn.addEventListener("click", () => {
    if (!state.selectedCountryId) return;
    promptInput("Nieuwe stad", "Stadnaam", (value) => {
      const daysStr = window.prompt(
        "Aantal dagen op deze plek (optioneel). Leeg laten = nog niet ingevuld. Annuleren = ook zonder dagen.",
        ""
      );
      const stayDays = daysStr === null ? null : parseOptionalStayDays(daysStr);
      state.data.places.push({
        id: uid(),
        countryId: state.selectedCountryId,
        type: "city",
        name: value.trim(),
        stayDays,
        sortOrder: nextPlaceSortOrder(state.selectedCountryId)
      });
      state.locationStatusMessage = "";
      saveAndRender();
    });
  });

  el.addAreaBtn.addEventListener("click", () => {
    if (!state.selectedCountryId) return;
    promptInput("Nieuw gebied", "Gebiedsnaam", (value) => {
      const daysStr = window.prompt(
        "Aantal dagen op deze plek (optioneel). Leeg laten = nog niet ingevuld. Annuleren = ook zonder dagen.",
        ""
      );
      const stayDays = daysStr === null ? null : parseOptionalStayDays(daysStr);
      state.data.places.push({
        id: uid(),
        countryId: state.selectedCountryId,
        type: "area",
        name: value.trim(),
        stayDays,
        sortOrder: nextPlaceSortOrder(state.selectedCountryId)
      });
      state.locationStatusMessage = "";
      saveAndRender();
    });
  });

  el.addActivityBtn.addEventListener("click", async () => {
    ensurePlaceSelection();
    if (!state.selectedPlaceId) {
      window.alert("Kies eerst een stad of gebied voordat je een activiteit toevoegt.");
      return;
    }

    const payload = await promptEntityDetails("Nieuwe activiteit", {
      nameLabel: "Titel activiteit",
      nameInitial: "",
      addressInitial: "",
      mapsLinkInitial: "",
      includePhoto: true,
      photoInitial: ""
    });
    if (!payload) return;

    const newActivity = {
      id: uid(),
      placeId: state.selectedPlaceId,
      title: payload.name,
      notes: "",
      date: null,
      address: payload.address,
      mapsLink: payload.mapsLink,
      photoUrl: payload.photoUrl,
      latitude: null,
      longitude: null,
      sortOrder: nextActivitySortOrder(state.selectedPlaceId)
    };
    state.data.activities.push(newActivity);

    const status = await resolveItemLocation({
      item: newActivity,
      itemType: "activiteit",
      currentName: newActivity.title
    });
    state.locationStatusMessage = status.message;
    saveAndRender();
  });

  el.addHotelBtn.addEventListener("click", async () => {
    ensurePlaceSelection();
    if (!state.selectedPlaceId) {
      window.alert("Kies eerst een stad of gebied voordat je een hotel toevoegt.");
      return;
    }

    const payload = await promptEntityDetails("Nieuw hotel", {
      nameLabel: "Naam hotel",
      nameInitial: "",
      addressInitial: "",
      mapsLinkInitial: "",
      includeWebsite: true,
      websiteUrlInitial: "",
      websiteBeforeMaps: true,
      includePhoto: true,
      photoInitial: "",
      includePrice: true,
      priceInitial: ""
    });
    if (!payload) return;

    const newHotel = {
      id: uid(),
      placeId: state.selectedPlaceId,
      name: payload.name,
      address: payload.address,
      mapsLink: payload.mapsLink,
      websiteUrl: payload.websiteUrl ?? "",
      photoUrl: payload.photoUrl || "",
      priceLabel: payload.priceLabel || "",
      latitude: null,
      longitude: null,
      sortOrder: nextHotelSortOrder(state.selectedPlaceId)
    };
    state.data.hotels.push(newHotel);

    const status = await resolveItemLocation({
      item: newHotel,
      itemType: "hotel",
      currentName: newHotel.name
    });
    state.locationStatusMessage = status.message;
    saveAndRender();
  });

  let resizeRenderTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeRenderTimer);
    resizeRenderTimer = setTimeout(() => renderAll(), 200);
  });
}

function renderAll() {
  updateTripLayout();
  renderHero();
  renderCountries();
  renderPlaces();
  renderItems();
  renderMap();
  updateButtons();
}

function renderHero() {
  if (!el.heroTitle || !el.heroSubtitle) return;
  const country = state.data.countries.find((c) => c.id === state.selectedCountryId);
  el.heroTitle.textContent = country ? country.name : "Vacation Planner";
  const places = state.data.places.filter((p) => p.countryId === state.selectedCountryId);
  let totalDays = 0;
  for (const p of places) {
    if (typeof p.stayDays === "number" && p.stayDays >= 1) {
      totalDays += p.stayDays;
    }
  }
  const n = places.length;
  if (!country) {
    el.heroSubtitle.textContent = "Voeg een land toe om te beginnen.";
    renderHeroWeather();
    applyHeroBackground(null);
    return;
  }
  if (!n) {
    el.heroSubtitle.textContent = "Nog geen bestemmingen — voeg steden of gebieden toe bij Route.";
    renderHeroWeather();
    applyHeroBackground(country);
    return;
  }
  const daysPart = totalDays > 0 ? `${totalDays} dagen` : "dagen nog niet ingevuld";
  el.heroSubtitle.textContent = `${daysPart} · ${n} bestemming${n === 1 ? "" : "en"}`;
  renderHeroWeather();
  applyHeroBackground(country);
}

function renderHeroWeather() {
  if (!el.heroWeather) return;
  const country = state.data.countries.find((c) => c.id === state.selectedCountryId);
  if (!country) {
    el.heroWeather.innerHTML = `<div class="hero-weather-temp">--</div><div class="hero-weather-desc">Geen land</div>`;
    return;
  }
  const coords = pickWeatherCoordinatesForCountry(state.selectedCountryId);
  if (!coords) {
    el.heroWeather.innerHTML = `<div class="hero-weather-temp">--</div><div class="hero-weather-desc">Geen locatie</div>`;
    return;
  }
  const requestToken = ++state.weatherRequestToken;
  el.heroWeather.innerHTML = `<div class="hero-weather-temp">...</div><div class="hero-weather-desc">Weer laden</div>`;
  void fetchCurrentWeather(coords.latitude, coords.longitude)
    .then((weather) => {
      if (requestToken !== state.weatherRequestToken) return;
      if (!weather) {
        el.heroWeather.innerHTML = `<div class="hero-weather-temp">--</div><div class="hero-weather-desc">Geen weerdata</div>`;
        return;
      }
      el.heroWeather.innerHTML = `<div class="hero-weather-temp">${escapeHtml(weather.tempText)}</div><div class="hero-weather-desc">${escapeHtml(weather.desc)}</div>`;
    })
    .catch(() => {
      if (requestToken !== state.weatherRequestToken) return;
      el.heroWeather.innerHTML = `<div class="hero-weather-temp">--</div><div class="hero-weather-desc">Weer niet beschikbaar</div>`;
    });
}

function pickWeatherCoordinatesForCountry(countryId) {
  if (!countryId) return null;
  const places = state.data.places
    .filter((p) => p.countryId === countryId)
    .sort(bySortOrderThenName);
  const selected = places.find((p) => p.id === state.selectedPlaceId) || places[0] || null;
  if (!selected) return null;
  const coords = getPlaceCoordinatesForRoute(selected);
  if (!coords) return null;
  return { latitude: coords[0], longitude: coords[1] };
}

async function fetchCurrentWeather(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&current=temperature_2m,weather_code&timezone=auto`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const payload = await response.json();
  const current = payload && payload.current ? payload.current : null;
  if (!current || typeof current.temperature_2m !== "number") return null;
  const weatherCode = typeof current.weather_code === "number" ? current.weather_code : -1;
  return {
    tempText: `${Math.round(current.temperature_2m)}°C`,
    desc: weatherCodeToDutch(weatherCode)
  };
}

function weatherCodeToDutch(code) {
  if (code === 0) return "Helder";
  if ([1, 2].includes(code)) return "Licht bewolkt";
  if (code === 3) return "Bewolkt";
  if ([45, 48].includes(code)) return "Mist";
  if ([51, 53, 55, 56, 57].includes(code)) return "Motregen";
  if ([61, 63, 65, 66, 67].includes(code)) return "Regen";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Sneeuw";
  if ([80, 81, 82].includes(code)) return "Buien";
  if ([95, 96, 99].includes(code)) return "Onweer";
  return "Onbekend";
}

function isSafeHeroImageUrl(url) {
  const t = String(url || "").trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(t) && t.length < 2_500_000) return true;
  return false;
}

function buildEntityPreviewImage(photoUrl) {
  const t = String(photoUrl || "").trim();
  return t && isSafeHeroImageUrl(t) ? t : "";
}

function buildActivityPreviewImage(activity) {
  return buildEntityPreviewImage(activity?.photoUrl);
}

function buildHotelPreviewImage(hotel) {
  return buildEntityPreviewImage(hotel?.photoUrl);
}

function lookupPlace(placeId) {
  return state.data.places.find((p) => p.id === placeId) ?? null;
}

function formatNightsLabel(stayDays) {
  if (typeof stayDays !== "number" || !Number.isFinite(stayDays) || stayDays <= 0) return "";
  return stayDays === 1 ? "1 nacht" : `${Math.round(stayDays)} nachten`;
}

function applyHeroBackground(country) {
  if (!el.heroBg) return;
  const grad = "linear-gradient(105deg, rgba(11, 16, 32, 0.92) 0%, rgba(11, 16, 32, 0.55) 45%, rgba(11, 16, 32, 0.25) 100%)";
  const raw = country && typeof country.heroImageUrl === "string" ? country.heroImageUrl.trim() : "";
  const img = raw && isSafeHeroImageUrl(raw) ? raw : DEFAULT_HERO_IMAGE;
  const urlCss = /^data:image\//i.test(img) ? img.replace(/\\/g, "/").replace(/"/g, "'") : encodeURI(img);
  el.heroBg.style.backgroundImage = `${grad}, url("${urlCss}")`;
}

function updateTripLayout() {
  if (el.tripStack) {
    el.tripStack.hidden = state.data.countries.length === 0;
  }
  el.main?.classList.toggle("multi-land", state.data.countries.length > 1);
}

function renderCountries() {
  const countries = [...state.data.countries].sort(byName("name"));

  if (el.countryChips) {
    el.countryChips.innerHTML = "";
    if (!countries.length) {
      const hint = document.createElement("span");
      hint.className = "meta";
      hint.textContent = "Geen landen — voeg er een toe bij Instellingen.";
      el.countryChips.appendChild(hint);
    } else {
      countries.forEach((country) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `country-chip${state.selectedCountryId === country.id ? " is-active" : ""}`;
        btn.textContent = country.name;
        btn.dataset.id = country.id;
        btn.addEventListener("click", () => {
          if (state.selectedCountryId === country.id) return;
          state.selectedCountryId = country.id;
          state.pendingPinTarget = null;
          state.locationStatusMessage = "";
          renderAll();
        });
        el.countryChips.appendChild(btn);
      });
    }
  }

  el.countriesList.innerHTML = "";
  if (!countries.length) {
    el.countriesList.innerHTML = `<li><span class="meta">Nog geen landen</span></li>`;
    return;
  }

  countries.forEach((country) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span class="name ${state.selectedCountryId === country.id ? "active" : ""}" data-id="${country.id}">${escapeHtml(country.name)}</span>
      <div class="row-actions">
        <button data-edit-country="${country.id}">Bewerk</button>
        <button class="danger" data-delete-country="${country.id}">Verwijder</button>
      </div>
    `;

    li.addEventListener("click", (event) => {
      if (event.target.closest(".row-actions")) return;
      state.selectedCountryId = country.id;
      state.pendingPinTarget = null;
      state.locationStatusMessage = "";
      renderAll();
    });

    li.querySelector(`[data-edit-country="${country.id}"]`).addEventListener("click", () => {
      promptInput("Bewerk land", "Landnaam", (value) => {
        country.name = value.trim();
        saveAndRender();
      }, country.name);
    });

    li.querySelector(`[data-delete-country="${country.id}"]`).addEventListener("click", () => {
      if (!confirm(`Verwijder "${country.name}" en alles daarin?`)) return;
      removeCountry(country.id);
      saveAndRender();
    });

    el.countriesList.appendChild(li);
  });
}

function placesForSelectedCountry() {
  if (!state.selectedCountryId) return [];
  return state.data.places
    .filter((p) => p.countryId === state.selectedCountryId)
    .sort(bySortOrderThenName);
}

/** Zorg dat gekozen plek bij het land hoort (voorkomt lege activiteiten/hotels op mobiel). */
function syncSelectedPlaceWithCountry() {
  const places = placesForSelectedCountry();
  if (!places.length) {
    state.selectedPlaceId = null;
    return;
  }
  if (!state.selectedPlaceId || !places.some((p) => p.id === state.selectedPlaceId)) {
    state.selectedPlaceId = places[0].id;
  }
}

function isMobileTripLayout() {
  try {
    return window.matchMedia("(max-width: 960px)").matches;
  } catch {
    return false;
  }
}

function isIPhoneDevice() {
  try {
    return /iPhone|iPod/i.test(String(navigator.userAgent || ""));
  } catch {
    return false;
  }
}

function renderPlaces() {
  const country = state.data.countries.find((c) => c.id === state.selectedCountryId);
  el.countryTitle.textContent = country ? `Route · ${country.name}` : "Route";

  syncSelectedPlaceWithCountry();
  renderPlaceList(el.placesList, placesForSelectedCountry());
}

function renderPlaceList(target, places) {
  target.innerHTML = "";
  if (!places.length) {
    target.innerHTML = `<li><span class="meta">Nog leeg</span></li>`;
    return;
  }

  places.forEach((place, index) => {
    const li = document.createElement("li");
    const typeLabel = place.type === "city" ? "Stad" : "Gebied";
    const daysLine = formatPlaceStayDaysLine(place.stayDays);
    const routeNum = index + 1;
    li.innerHTML = `
      <div class="place-row-left">
        <div class="route-row-head">
          <span class="route-list-num" aria-hidden="true">${routeNum}</span>
          <div class="place-row-main">
            <div class="place-days">${daysLine}</div>
            <span class="name ${state.selectedPlaceId === place.id ? "active" : ""}" data-id="${place.id}">${escapeHtml(place.name)} <span class="meta">(${typeLabel})</span></span>
          </div>
        </div>
      </div>
      <div class="row-actions">
        <button data-edit-place="${place.id}">Bewerk</button>
        <button class="danger" data-delete-place="${place.id}">Verwijder</button>
      </div>
    `;

    li.addEventListener("click", (event) => {
      if (event.target.closest(".row-actions")) return;
      state.selectedPlaceId = place.id;
      state.mapFocusAfterRender = place.id;
      renderAll();
    });

    li.querySelector(`[data-edit-place="${place.id}"]`).addEventListener("click", () => {
      promptInput("Bewerk plek", "Naam", (value) => {
        place.name = value.trim();
        const daysStr = window.prompt(
          "Aantal dagen op deze plek (optioneel). Leeg = wissen. Annuleren = dagen ongewijzigd.",
          place.stayDays != null ? String(place.stayDays) : ""
        );
        if (daysStr !== null) {
          place.stayDays = daysStr.trim() === "" ? null : parseOptionalStayDays(daysStr);
        }
        saveAndRender();
      }, place.name);
    });

    li.querySelector(`[data-delete-place="${place.id}"]`).addEventListener("click", () => {
      if (!confirm(`Verwijder "${place.name}" en alle items?`)) return;
      removePlace(place.id);
      saveAndRender();
    });

    target.appendChild(li);
  });
}

function renderItems() {
  syncSelectedPlaceWithCountry();

  const country = state.data.countries.find((c) => c.id === state.selectedCountryId);
  const placesInCountry = placesForSelectedCountry();
  const placeIdSet = new Set(placesInCountry.map((p) => p.id));
  // iPhone moet gelijk lopen met desktop: filter op geselecteerde plek i.p.v. land-aggregatie.
  const mobileAgg = isMobileTripLayout() && !isIPhoneDevice() && Boolean(state.selectedCountryId && placeIdSet.size);

  const place = state.data.places.find((p) => p.id === state.selectedPlaceId);
  const placeName = place ? place.name : "—";

  let activities;
  let hotels;
  if (mobileAgg) {
    activities = state.data.activities
      .filter((a) => placeIdSet.has(a.placeId))
      .sort(bySortOrderThenActivityTitle);
    hotels = state.data.hotels
      .filter((h) => placeIdSet.has(h.placeId))
      .sort(bySortOrderThenHotelName);
  } else {
    activities = state.data.activities
      .filter((a) => a.placeId === state.selectedPlaceId)
      .sort(bySortOrderThenActivityTitle);
    hotels = state.data.hotels
      .filter((h) => h.placeId === state.selectedPlaceId)
      .sort(bySortOrderThenHotelName);
  }

  if (mobileAgg && country) {
    el.activitiesCardTitle.textContent = `Activiteiten · ${country.name}`;
    el.hotelsCardTitle.textContent = `Hotels · ${country.name}`;
    if (el.activitiesCardHint) {
      el.activitiesCardHint.textContent = "Alle stops van deze route op een rij. Tik een plek bij Route om die als hoofdstop op de kaart te tonen.";
    }
    if (el.hotelsCardHint) {
      el.hotelsCardHint.textContent = "Alle hotels van dit land; onder elke titel staat bij welke stop ze horen.";
    }
  } else {
    el.activitiesCardTitle.textContent = place ? `${placeName}: activiteiten` : "Activiteiten";
    el.hotelsCardTitle.textContent = place ? `${placeName}: hotels` : "Hotels";
    if (el.activitiesCardHint) {
      el.activitiesCardHint.textContent = place
        ? "Kies een andere stop via de route of tik op het nummer op de kaart. Maps-link met coördinaten = pin op de kaart."
        : "Kies een bestemming in de route of op de kaart (nummers).";
    }
    if (el.hotelsCardHint) {
      el.hotelsCardHint.textContent = place
        ? "Zelfde plek als bij Activiteiten. Hotelwebsite + Maps-link; coördinaten = pin. Wissel van plek via route of kaartnummers."
        : "Kies een bestemming in de route of op de kaart (nummers).";
    }
  }

  renderActivityList(activities);
  renderHotelList(hotels);
}

function renderActivityList(activities) {
  el.activitiesList.innerHTML = "";
  if (!activities.length) {
    el.activitiesList.innerHTML = `<li><span class="meta">Nog geen activiteiten</span></li>`;
    return;
  }

  activities.forEach((activity) => {
    const place = lookupPlace(activity.placeId);
    const subtitle = place?.name || activity.address || "";
    const previewSrc = buildActivityPreviewImage(activity);
    const thumbHtml = previewSrc
      ? `<img class="list-thumb" src="${escapeHtml(previewSrc)}" width="52" height="52" loading="lazy" decoding="async" alt="">`
      : `<div class="list-thumb list-thumb--placeholder" aria-hidden="true"></div>`;

    const li = document.createElement("li");
    li.innerHTML = `
      <div class="list-row-main">
        <div class="list-thumb-wrap">${thumbHtml}</div>
        <div class="list-row-text">
          <div class="list-row-title">${escapeHtml(activity.title)}</div>
          <div class="list-row-sub">${escapeHtml(subtitle)}</div>
        </div>
      </div>
      <div class="row-actions">
        <button class="secondary" data-loc-activity="${activity.id}">Pin op kaart</button>
        <button data-edit-activity="${activity.id}">Bewerk</button>
        <button class="danger" data-delete-activity="${activity.id}">Verwijder</button>
      </div>
    `;

    li.querySelector(`[data-loc-activity="${activity.id}"]`).addEventListener("click", () => {
      state.pendingPinTarget = { kind: "activity", id: activity.id };
      state.locationStatusMessage = `Pinmodus actief voor activiteit "${activity.title}".`;
      window.alert(`Tik nu op de kaart om de locatie voor activiteit "${activity.title}" te zetten.`);
      renderMap();
    });

    li.querySelector(`[data-edit-activity="${activity.id}"]`).addEventListener("click", async () => {
      const payload = await promptEntityDetails("Bewerk activiteit", {
        nameLabel: "Titel activiteit",
        nameInitial: activity.title,
        addressInitial: activity.address || "",
        mapsLinkInitial: activity.mapsLink || "",
        includePhoto: true,
        photoInitial: activity.photoUrl || ""
      });
      if (!payload) return;

      activity.title = payload.name;
      activity.address = payload.address;
      activity.mapsLink = payload.mapsLink;
      activity.photoUrl = payload.photoUrl || "";

      const status = await resolveItemLocation({
        item: activity,
        itemType: "activiteit",
        currentName: activity.title
      });
      state.locationStatusMessage = status.message;
      saveAndRender();
    });

    li.querySelector(`[data-delete-activity="${activity.id}"]`).addEventListener("click", () => {
      state.data.activities = state.data.activities.filter((a) => a.id !== activity.id);
      if (state.pendingPinTarget?.kind === "activity" && state.pendingPinTarget.id === activity.id) {
        state.pendingPinTarget = null;
      }
      saveAndRender();
    });

    el.activitiesList.appendChild(li);
  });
}

function renderHotelList(hotels) {
  el.hotelsList.innerHTML = "";
  if (!hotels.length) {
    el.hotelsList.innerHTML = `<li><span class="meta">Nog geen hotels</span></li>`;
    return;
  }

  const showPriceInlineForIPhone = isIPhoneDevice();
  hotels.forEach((hotel) => {
    const place = lookupPlace(hotel.placeId);
    const placeName = place?.name || "";
    const nights = formatNightsLabel(place?.stayDays);
    const subtitle = [placeName, nights].filter(Boolean).join(" • ");
    const previewSrc = buildHotelPreviewImage(hotel);
    const thumbHtml = previewSrc
      ? `<img class="list-thumb" src="${escapeHtml(previewSrc)}" width="52" height="52" loading="lazy" decoding="async" alt="">`
      : `<div class="list-thumb list-thumb--placeholder" aria-hidden="true"></div>`;
    const priceHtml = hotel.priceLabel
      ? `<div class="list-row-price">${escapeHtml(hotel.priceLabel)}</div>`
      : `<div class="list-row-price list-row-price--muted">—</div>`;
    const websiteBlock = hotel.websiteUrl && String(hotel.websiteUrl).trim()
      ? `<div class="meta hotel-link-row hotel-link-row--compact">${formatHotelWebsiteRow(hotel.websiteUrl)}</div>`
      : "";

    const li = document.createElement("li");
    const titleHtml = showPriceInlineForIPhone && hotel.priceLabel
      ? `${escapeHtml(hotel.name)} <span class="meta">(${escapeHtml(hotel.priceLabel)})</span>`
      : escapeHtml(hotel.name);
    li.innerHTML = `
      <div class="list-row-main">
        <div class="list-thumb-wrap">${thumbHtml}</div>
        <div class="list-row-text">
          <div class="list-row-title">${titleHtml}</div>
          <div class="list-row-sub">${escapeHtml(subtitle || "—")}</div>
          ${websiteBlock}
        </div>
        ${showPriceInlineForIPhone ? "" : priceHtml}
      </div>
      <div class="row-actions">
        <button class="secondary" data-loc-hotel="${hotel.id}">Pin op kaart</button>
        <button data-edit-hotel="${hotel.id}">Bewerk</button>
        <button class="danger" data-delete-hotel="${hotel.id}">Verwijder</button>
      </div>
    `;

    li.querySelector(`[data-loc-hotel="${hotel.id}"]`).addEventListener("click", () => {
      state.pendingPinTarget = { kind: "hotel", id: hotel.id };
      state.locationStatusMessage = `Pinmodus actief voor hotel "${hotel.name}".`;
      window.alert(`Tik nu op de kaart om de locatie voor hotel "${hotel.name}" te zetten.`);
      renderMap();
    });

    li.querySelector(`[data-edit-hotel="${hotel.id}"]`).addEventListener("click", async () => {
      const payload = await promptEntityDetails("Bewerk hotel", {
        nameLabel: "Naam hotel",
        nameInitial: hotel.name,
        addressInitial: hotel.address || "",
        mapsLinkInitial: hotel.mapsLink || "",
        includeWebsite: true,
        websiteUrlInitial: hotel.websiteUrl || "",
        websiteBeforeMaps: true,
        includePhoto: true,
        photoInitial: hotel.photoUrl || "",
        includePrice: true,
        priceInitial: hotel.priceLabel || ""
      });
      if (!payload) return;

      hotel.name = payload.name;
      hotel.address = payload.address;
      hotel.mapsLink = payload.mapsLink;
      hotel.websiteUrl = payload.websiteUrl ?? "";
      hotel.photoUrl = payload.photoUrl || "";
      hotel.priceLabel = payload.priceLabel || "";

      const status = await resolveItemLocation({
        item: hotel,
        itemType: "hotel",
        currentName: hotel.name
      });
      state.locationStatusMessage = status.message;
      saveAndRender();
    });

    li.querySelector(`[data-delete-hotel="${hotel.id}"]`).addEventListener("click", () => {
      state.data.hotels = state.data.hotels.filter((h) => h.id !== hotel.id);
      if (state.pendingPinTarget?.kind === "hotel" && state.pendingPinTarget.id === hotel.id) {
        state.pendingPinTarget = null;
      }
      saveAndRender();
    });

    el.hotelsList.appendChild(li);
  });
}

function updateButtons() {
  el.addCityBtn.disabled = !state.selectedCountryId;
  el.addAreaBtn.disabled = !state.selectedCountryId;
  el.addActivityBtn.disabled = !state.selectedPlaceId;
  el.addHotelBtn.disabled = !state.selectedPlaceId;
}

function ensurePlaceSelection() {
  syncSelectedPlaceWithCountry();
}

function focusMapOnPlace(placeId) {
  if (!map || !window.L || !placeId) return;
  const place = state.data.places.find((p) => p.id === placeId);
  if (!place) return;
  const pts = [];
  const ownCoords = getPlaceCoordinatesForRoute(place);
  if (ownCoords) {
    pts.push(ownCoords);
  }
  state.data.activities
    .filter((a) => a.placeId === placeId && hasCoordinates(a))
    .forEach((a) => pts.push([a.latitude, a.longitude]));
  state.data.hotels
    .filter((h) => h.placeId === placeId && hasCoordinates(h))
    .forEach((h) => pts.push([h.latitude, h.longitude]));
  if (!pts.length) return;
  if (pts.length === 1) {
    map.flyTo(pts[0], 12, { animate: true, duration: 0.45 });
    return;
  }
  const b = L.latLngBounds(pts);
  map.flyToBounds(b, { padding: [44, 44], maxZoom: 14, animate: true, duration: 0.55 });
}

function renderMap() {
  if (!el.placeMap) return;
  if (!window.L) {
    el.mapHint.textContent = "Kaart kon niet geladen worden.";
    return;
  }

  if (!map) {
    map = L.map(el.placeMap).setView([20, 0], 2);
    const baseSatelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
      }
    );
    const osmFallbackLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    });

    baseSatelliteLayer.on("tileerror", () => {
      if (!map.hasLayer(osmFallbackLayer)) {
        map.addLayer(osmFallbackLayer);
      }
    });

    const labelsLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 20,
        opacity: 0.92,
        attribution: "Labels &copy; OpenStreetMap contributors &copy; CARTO"
      }
    );

    baseSatelliteLayer.addTo(map);
    labelsLayer.addTo(map);

    map.on("click", (event) => {
      if (!state.pendingPinTarget) return;
      applyManualPin(event.latlng.lat, event.latlng.lng, state.pendingPinTarget);
      state.pendingPinTarget = null;
      state.locationStatusMessage = "Pin handmatig gezet op kaart.";
      saveAndRender();
    });
  }

  mapMarkers.forEach((marker) => marker.remove());
  mapMarkers = [];
  if (routePolyline) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }

  const routePlaces = state.data.places
    .filter((p) => p.countryId === state.selectedCountryId)
    .sort(bySortOrderThenName)
    .map((p) => ({ place: p, coords: getPlaceCoordinatesForRoute(p) }))
    .filter((row) => Boolean(row.coords));

  const routeLatLngs = routePlaces.map((row) => row.coords);

  const selectedPlaceActivities = state.data.activities
    .filter((a) => a.placeId === state.selectedPlaceId)
    .filter(hasCoordinates);

  const selectedPlaceHotels = state.data.hotels
    .filter((h) => h.placeId === state.selectedPlaceId)
    .filter(hasCoordinates);

  const hasRoute = routeLatLngs.length > 0;
  const hasDetailPins = selectedPlaceActivities.length + selectedPlaceHotels.length > 0;

  const placesInCountry = state.data.places.filter((p) => p.countryId === state.selectedCountryId);
  const missingPlaceCoords = placesInCountry.filter((p) => !getPlaceCoordinatesForRoute(p));
  renderMapInsights({
    placesInCountry,
    routePlaces,
    routeLatLngs
  });
  // Ook als er al 1 routepunt zichtbaar is, ontbrekende stops blijven geocoden
  // zodat alle routenummers (bijv. 1-2-3) terugkomen op de kaart.
  if (!state.geocodeInFlight && missingPlaceCoords.length > 0) {
    void geocodeMissingPlaceCoordinates(state.selectedCountryId);
  }

  if (!hasRoute && !hasDetailPins && !state.pendingPinTarget) {
    el.mapHint.textContent = state.locationStatusMessage
      || (state.geocodeInFlight
        ? "Locaties ophalen voor route... even wachten."
        : "Voeg coördinaten toe aan plekken (via seed of toekomstige invoer) of zet activiteiten/hotels met Maps-link om de kaart te vullen.");
    map.setView([20, 0], 2);
    setTimeout(() => map.invalidateSize(), 0);
    return;
  }

  const pendingLabel = resolvePendingLabel();
  if (pendingLabel) {
    el.mapHint.textContent = `Pinmodus actief: tik op de kaart voor "${pendingLabel}".`;
    el.placeMap.style.cursor = "crosshair";
  } else {
    const routeHint = hasRoute
      ? `${routePlaces.length}/${placesInCountry.length} routestops op kaart`
      : "geen routepunten";
    const detailHint = hasDetailPins
      ? `${selectedPlaceActivities.length + selectedPlaceHotels.length} pins (huidige plek)`
      : "geen activiteit/hotel-pins voor deze plek";
    el.mapHint.textContent = state.locationStatusMessage
      || `Kaart: ${routeHint} · ${detailHint}. Tik op een routenummer om die plek te kiezen.`;
    el.placeMap.style.cursor = "";
  }

  if (routeLatLngs.length >= 2) {
    routePolyline = L.polyline(routeLatLngs, {
      color: "#38bdf8",
      weight: 2.5,
      opacity: 0.8,
      dashArray: "4 10",
      lineCap: "round"
    }).addTo(map);
  }

  routePlaces.forEach((row, i) => {
    const place = row.place;
    const markerCoords = row.coords;
    const n = i + 1;
    const isSel = place.id === state.selectedPlaceId;
    const icon = L.divIcon({
      className: "route-num-marker",
      html: `<div class="route-num${isSel ? " is-active" : ""}">${n}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    const marker = L.marker(markerCoords, { icon, zIndexOffset: 200 + n })
      .addTo(map)
      .bindPopup(
        `<strong>${escapeHtml(place.name)}</strong><br>${place.type === "city" ? "Stad" : "Gebied"}<br><span style="font-size:12px;opacity:.88">Tik = activiteiten &amp; hotels voor deze stop</span>`
      );
    marker.on("click", (e) => {
      L.DomEvent.stopPropagation(e);
      if (state.selectedPlaceId !== place.id) {
        state.selectedPlaceId = place.id;
        state.pendingPinTarget = null;
        state.locationStatusMessage = "";
        state.mapFocusAfterRender = place.id;
        renderAll();
        return;
      }
      marker.openPopup();
    });
    mapMarkers.push(marker);
  });

  const bounds = [...routeLatLngs];

  selectedPlaceActivities.forEach((activity) => {
    const marker = L.circleMarker([activity.latitude, activity.longitude], {
      radius: 7,
      weight: 2,
      color: "#22d3ee",
      fillColor: "#22d3ee",
      fillOpacity: 0.85
    })
      .addTo(map)
      .bindPopup(`<strong>Activiteit</strong><br>${escapeHtml(activity.title)}`);

    const previewImage = buildActivityPreviewImage(activity);
    marker.bindTooltip(`
      <div style="min-width:180px; max-width:220px;">
        <div style="font-weight:600; margin-bottom:6px;">${escapeHtml(activity.title)}</div>
        ${previewImage ? `<img src="${escapeHtml(previewImage)}" alt="preview" style="width:100%; height:100px; object-fit:cover; border-radius:8px;" />` : `<div style="font-size:12px; opacity:.8;">Geen preview foto beschikbaar</div>`}
      </div>
    `, { direction: "top", opacity: 0.97, sticky: true });

    marker.on("mouseover", () => marker.openTooltip());
    marker.on("mouseout", () => marker.closeTooltip());
    marker.on("click", () => {
      if (activity.mapsLink && /^https?:\/\//i.test(activity.mapsLink)) {
        window.open(activity.mapsLink, "_blank", "noopener,noreferrer");
      } else {
        marker.openPopup();
      }
    });

    mapMarkers.push(marker);
    bounds.push([activity.latitude, activity.longitude]);
  });

  selectedPlaceHotels.forEach((hotel) => {
    const marker = L.circleMarker([hotel.latitude, hotel.longitude], {
      radius: 7,
      weight: 2,
      color: "#f59e0b",
      fillColor: "#f59e0b",
      fillOpacity: 0.85
    })
      .addTo(map)
      .bindPopup(`<strong>Hotel</strong><br>${escapeHtml(hotel.name)}`);

    const hotelPreview = buildHotelPreviewImage(hotel);
    const priceTip = hotel.priceLabel ? escapeHtml(hotel.priceLabel) : "";
    marker.bindTooltip(`
      <div style="min-width:180px; max-width:220px;">
        <div style="font-weight:600; margin-bottom:6px;">${escapeHtml(hotel.name)}</div>
        ${priceTip ? `<div style="font-size:12px; opacity:.9; margin-bottom:6px;">${priceTip}</div>` : ""}
        ${hotelPreview ? `<img src="${escapeHtml(hotelPreview)}" alt="preview" style="width:100%; height:100px; object-fit:cover; border-radius:8px;" />` : `<div style="font-size:12px; opacity:.8;">Geen preview foto</div>`}
      </div>
    `, { direction: "top", opacity: 0.97, sticky: true });

    marker.on("mouseover", () => marker.openTooltip());
    marker.on("mouseout", () => marker.closeTooltip());
    marker.on("click", () => {
      if (hotel.websiteUrl && isSafeWebUrl(hotel.websiteUrl)) {
        window.open(hotel.websiteUrl.trim(), "_blank", "noopener,noreferrer");
      } else if (hotel.mapsLink && /^https?:\/\//i.test(hotel.mapsLink)) {
        window.open(hotel.mapsLink, "_blank", "noopener,noreferrer");
      } else {
        marker.openPopup();
      }
    });

    mapMarkers.push(marker);
    bounds.push([hotel.latitude, hotel.longitude]);
  });

  const focusId = state.mapFocusAfterRender;
  if (focusId) {
    state.mapFocusAfterRender = null;
  }

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [22, 22], maxZoom: 12 });
  } else {
    map.setView([20, 0], 2);
  }

  if (focusId) {
    setTimeout(() => focusMapOnPlace(focusId), 380);
  }

  setTimeout(() => map.invalidateSize(), 0);
}

function getPlaceCoordinatesForRoute(place) {
  if (!place) return null;
  if (hasCoordinates(place)) return [place.latitude, place.longitude];

  const fromActivity = state.data.activities.find((a) => a.placeId === place.id && hasCoordinates(a));
  if (fromActivity) return [fromActivity.latitude, fromActivity.longitude];

  const fromHotel = state.data.hotels.find((h) => h.placeId === place.id && hasCoordinates(h));
  if (fromHotel) return [fromHotel.latitude, fromHotel.longitude];

  return null;
}

function renderMapInsights({ placesInCountry, routePlaces, routeLatLngs }) {
  if (!el.mapRouteSummary || !el.mapBudgetSummary) return;
  const country = state.data.countries.find((c) => c.id === state.selectedCountryId) || null;
  const placeIds = new Set(placesInCountry.map((p) => p.id));
  const hotelsInCountry = state.data.hotels
    .filter((h) => placeIds.has(h.placeId))
    .sort(bySortOrderThenHotelName);
  const activitiesInCountry = state.data.activities
    .filter((a) => placeIds.has(a.placeId))
    .sort(bySortOrderThenActivityTitle);

  const autoRouteKm = sumRouteDistanceKm(routeLatLngs);
  const hasManualRouteKm = Boolean(country && typeof country.routeKmManual === "number" && Number.isFinite(country.routeKmManual));
  const totalRouteKm = hasManualRouteKm ? country.routeKmManual : autoRouteKm;
  const routeRows = placesInCountry.slice(0, 6).map((place, index) => {
    const hotel = hotelsInCountry.find((h) => h.placeId === place.id);
    return `<li><span>${index + 1}. ${escapeHtml(place.name)}</span><span class="meta">${hotel ? `-> ${escapeHtml(hotel.name)}` : "-> geen hotel"}</span></li>`;
  });
  if (!routeRows.length) {
    routeRows.push(`<li><span class="meta">Nog geen routepunten.</span></li>`);
  }
  el.mapRouteSummary.innerHTML = `
    <div class="map-insight-head">
      <div class="map-insight-title">Route</div>
      <button type="button" class="budget-edit-btn" data-edit-route-km>KM bewerken</button>
    </div>
    <div class="map-insight-kpis">
      <div><strong>${routePlaces.length}/${placesInCountry.length}</strong><span>op kaart</span></div>
      <div><strong>${formatNumberNl(totalRouteKm, 1)} km</strong><span>${hasManualRouteKm ? "handmatig" : "automatisch"}</span></div>
    </div>
    <ul class="map-insight-list">${routeRows.join("")}</ul>
  `;
  const editKmBtn = el.mapRouteSummary.querySelector("[data-edit-route-km]");
  if (editKmBtn) {
    editKmBtn.addEventListener("click", () => {
      if (!country) return;
      promptEditRouteKm(country, autoRouteKm);
    });
  }

  const hotelsBudget = country ? normalizeBudgetValue(country.budgetHotels) : 0;
  const activitiesBudget = country ? normalizeBudgetValue(country.budgetActivities) : 0;
  const otherBudget = country ? normalizeBudgetValue(country.budgetOther) : 0;
  const totalBudget = hotelsBudget + activitiesBudget + otherBudget;
  const hotelsPct = totalBudget > 0 ? Math.round((hotelsBudget / totalBudget) * 100) : 0;
  const activitiesPct = totalBudget > 0 ? Math.round((activitiesBudget / totalBudget) * 100) : 0;
  const otherPct = totalBudget > 0 ? Math.max(0, 100 - hotelsPct - activitiesPct) : 0;
  const donutStyle = totalBudget > 0
    ? `style="background: conic-gradient(#3b82f6 0 ${hotelsPct}%, #fb923c ${hotelsPct}% ${hotelsPct + activitiesPct}%, #64748b ${hotelsPct + activitiesPct}% 100%);"`
    : `style="background: conic-gradient(#334155 0 100%);"`;
  el.mapBudgetSummary.innerHTML = `
    <div class="map-insight-head">
      <div class="map-insight-title">Budget overzicht</div>
      <button type="button" class="budget-edit-btn" data-edit-budget>Bewerken</button>
    </div>
    <div class="budget-overview-row">
      <div class="budget-donut" ${donutStyle}>
        <span>${formatEuro(totalBudget)}</span>
      </div>
      <div class="budget-lines">
        <div><span class="dot dot-hotel"></span>Hotels <strong>${formatEuro(hotelsBudget)}</strong></div>
        <div><span class="dot dot-activity"></span>Activiteiten <strong>${formatEuro(activitiesBudget)}</strong></div>
        <div><span class="dot dot-other"></span>Overig <strong>${formatEuro(otherBudget)}</strong></div>
      </div>
    </div>
  `;
  const editBudgetBtn = el.mapBudgetSummary.querySelector("[data-edit-budget]");
  if (editBudgetBtn) {
    editBudgetBtn.addEventListener("click", () => {
      if (!country) return;
      promptEditCountryBudget(country);
    });
  }
}

function sumRouteDistanceKm(routeLatLngs) {
  if (!Array.isArray(routeLatLngs) || routeLatLngs.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < routeLatLngs.length; i += 1) {
    const prev = routeLatLngs[i - 1];
    const cur = routeLatLngs[i];
    total += distanceKm(prev[0], prev[1], cur[0], cur[1]);
  }
  return Number.isFinite(total) ? total : 0;
}

function parsePriceEuro(rawValue) {
  const text = String(rawValue || "").replace(",", ".").replace(/\s+/g, " ");
  const match = text.match(/(-?\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const num = Number(match[1]);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function formatEuro(value) {
  const amount = Number.isFinite(value) ? value : 0;
  return `€${Math.round(amount).toLocaleString("nl-NL")}`;
}

function formatNumberNl(value, digits = 0) {
  const num = Number.isFinite(value) ? value : 0;
  return num.toLocaleString("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function normalizeBudgetValue(value) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const parsed = parseBudgetInput(value);
    return parsed == null ? 0 : parsed;
  }
  return 0;
}

function normalizeOptionalKmValue(value) {
  if (value == null || value === "") return null;
  const text = String(value).replace(",", ".").trim();
  const match = text.match(/^\d+(?:\.\d+)?$/);
  if (!match) return null;
  const num = Number(match[0]);
  if (!Number.isFinite(num) || num < 0) return null;
  return Number(num.toFixed(1));
}

function parseBudgetInput(raw) {
  const text = String(raw || "").replace(",", ".").trim();
  if (!text) return 0;
  const match = text.match(/^\d+(?:\.\d+)?$/);
  if (!match) return null;
  const num = Number(match[0]);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num);
}

function promptBudgetValue(label, initialValue) {
  while (true) {
    const raw = window.prompt(`${label}\nVul bedrag in euro in (bijv. 300)`, String(initialValue));
    if (raw === null) return null;
    const parsed = parseBudgetInput(raw);
    if (parsed == null) {
      window.alert("Vul een geldig bedrag in (alleen cijfers, optioneel decimalen).");
      continue;
    }
    return parsed;
  }
}

function promptEditCountryBudget(country) {
  const currentHotels = normalizeBudgetValue(country.budgetHotels);
  const currentActivities = normalizeBudgetValue(country.budgetActivities);
  const currentOther = normalizeBudgetValue(country.budgetOther);
  const hotels = promptBudgetValue(`Budget hotels - ${country.name}`, currentHotels);
  if (hotels === null) return;
  const activities = promptBudgetValue(`Budget activiteiten - ${country.name}`, currentActivities);
  if (activities === null) return;
  const other = promptBudgetValue(`Budget overig - ${country.name}`, currentOther);
  if (other === null) return;
  country.budgetHotels = hotels;
  country.budgetActivities = activities;
  country.budgetOther = other;
  state.locationStatusMessage = `Budget bijgewerkt voor ${country.name}.`;
  saveAndRender();
}

function promptEditRouteKm(country, autoKm) {
  const current = typeof country.routeKmManual === "number" && Number.isFinite(country.routeKmManual)
    ? String(country.routeKmManual)
    : "";
  const raw = window.prompt(
    `Route afstand - ${country.name}\nVul km in (bijv. 12,4).\nLeeg laten = automatisch (${formatNumberNl(autoKm, 1)} km).`,
    current
  );
  if (raw === null) return;
  const t = String(raw).trim();
  if (!t) {
    country.routeKmManual = null;
    state.locationStatusMessage = `Route-km terug op automatisch voor ${country.name}.`;
    saveAndRender();
    return;
  }
  const parsed = normalizeOptionalKmValue(t);
  if (parsed == null) {
    window.alert("Vul een geldig km-getal in (bijv. 12,4).");
    return;
  }
  country.routeKmManual = parsed;
  state.locationStatusMessage = `Route-km handmatig ingesteld voor ${country.name}.`;
  saveAndRender();
}

async function geocodeMissingPlaceCoordinates(countryId) {
  if (state.geocodeInFlight || !countryId) return;
  const country = state.data.countries.find((c) => c.id === countryId);
  if (!country) return;

  const places = state.data.places
    .filter((p) => p.countryId === countryId)
    .filter((p) => !getPlaceCoordinatesForRoute(p));
  if (!places.length) return;

  state.geocodeInFlight = true;
  let changed = false;

  try {
    for (const place of places) {
      const query = `${place.name}, ${country.name}`;
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
      try {
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) continue;
        const results = await response.json();
        if (!Array.isArray(results) || !results.length) continue;
        const first = results[0];
        const lat = Number(first.lat);
        const lon = Number(first.lon);
        if (!isValidCoordinate(lat, lon)) continue;
        place.latitude = lat;
        place.longitude = lon;
        changed = true;
      } catch {
        // Ignore geocoding errors per place; user can still pin manually.
      }
    }
  } finally {
    state.geocodeInFlight = false;
  }

  if (changed) {
    saveAndRender();
  } else {
    renderMap();
  }
}

function applyManualPin(lat, lng, target) {
  if (!target) return;
  const latFixed = Number(lat.toFixed(6));
  const lngFixed = Number(lng.toFixed(6));

  if (target.kind === "place") {
    const place = state.data.places.find((p) => p.id === target.id);
    if (!place) return;
    place.latitude = latFixed;
    place.longitude = lngFixed;
    return;
  }

  if (target.kind === "activity") {
    const activity = state.data.activities.find((a) => a.id === target.id);
    if (!activity) return;
    activity.latitude = latFixed;
    activity.longitude = lngFixed;
    return;
  }

  if (target.kind === "hotel") {
    const hotel = state.data.hotels.find((h) => h.id === target.id);
    if (!hotel) return;
    hotel.latitude = latFixed;
    hotel.longitude = lngFixed;
  }
}

function resolvePendingLabel() {
  if (!state.pendingPinTarget) return null;
  if (state.pendingPinTarget.kind === "place") {
    return state.data.places.find((p) => p.id === state.pendingPinTarget.id)?.name ?? null;
  }
  if (state.pendingPinTarget.kind === "activity") {
    return state.data.activities.find((a) => a.id === state.pendingPinTarget.id)?.title ?? null;
  }
  if (state.pendingPinTarget.kind === "hotel") {
    return state.data.hotels.find((h) => h.id === state.pendingPinTarget.id)?.name ?? null;
  }
  return null;
}

async function resolveItemLocation({ item, itemType, currentName }) {
  const linksToTry = [item.mapsLink];
  if (typeof item.websiteUrl === "string" && item.websiteUrl.trim()) {
    linksToTry.push(item.websiteUrl);
  }
  for (const raw of linksToTry) {
    const parsed = extractCoordinatesFromGoogleMapsLink(String(raw || ""));
    if (parsed) {
      item.latitude = parsed.latitude;
      item.longitude = parsed.longitude;
      return { resolved: true, message: `Pin voor ${itemType} "${currentName}" gezet via link (Google Maps).` };
    }
  }

  return {
    resolved: false,
    message: `Geen bruikbare coördinaten in de Google Maps-link voor ${itemType} "${currentName}". Korte goo.gl-links werken niet altijd — plak de volledige maps-URL, of gebruik "Pin op kaart".`
  };
}

function extractCoordinatesFromGoogleMapsLink(linkValue) {
  if (!linkValue || typeof linkValue !== "string") return null;
  let value = linkValue.trim();
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  if (!value) return null;

  const latLngPatterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // .../@13.75,100.49,17z
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // ...!3d13.75!4d100.49
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i
  ];

  for (const pattern of latLngPatterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (isValidCoordinate(latitude, longitude)) {
      return { latitude, longitude };
    }
  }

  const reversed = value.match(/!4d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
  if (reversed) {
    const longitude = Number(reversed[1]);
    const latitude = Number(reversed[2]);
    if (isValidCoordinate(latitude, longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

async function promptEntityDetails(title, {
  nameLabel,
  nameInitial,
  addressInitial,
  mapsLinkInitial,
  includePhoto = false,
  photoInitial = "",
  includeWebsite = false,
  websiteUrlInitial = "",
  websiteBeforeMaps = false,
  includePrice = false,
  priceInitial = ""
}) {
  const nameValue = window.prompt(`${title}\n${nameLabel}`, nameInitial || "");
  if (nameValue === null) return null;
  const trimmedName = nameValue.trim();
  if (!trimmedName) return null;

  const addressValue = window.prompt(`${title}\nAdres (optioneel)`, addressInitial || "");
  if (addressValue === null) return null;

  let websiteUrl = "";
  let mapsLinkValue = "";

  if (includeWebsite && websiteBeforeMaps) {
    const websitePrompt = window.prompt(
      `${title}\nHotelwebsite of bookinglink (optioneel, opent vanuit de lijst)`,
      websiteUrlInitial || ""
    );
    if (websitePrompt === null) return null;
    websiteUrl = websitePrompt.trim();

    const mapsPrompt = window.prompt(
      `${title}\nGoogle Maps-link (optioneel — als hier coördinaten in zitten, komt de pin automatisch op de kaart)`,
      mapsLinkInitial || ""
    );
    if (mapsPrompt === null) return null;
    mapsLinkValue = mapsPrompt.trim();
  } else {
    const mapsPrompt = window.prompt(
      `${title}\nGoogle Maps-link (optioneel — coördinaten in de link zetten de pin automatisch op de kaart)`,
      mapsLinkInitial || ""
    );
    if (mapsPrompt === null) return null;
    mapsLinkValue = mapsPrompt.trim();

    if (includeWebsite) {
      const websitePrompt = window.prompt(
        `${title}\nHotelwebsite of bookinglink (optioneel, opent vanuit de lijst)`,
        websiteUrlInitial || ""
      );
      if (websitePrompt === null) return null;
      websiteUrl = websitePrompt.trim();
    }
  }

  let photoUrl = "";
  if (includePhoto) {
    const photoValue = window.prompt(
      `${title}\nFoto preview (optioneel)\nPlak afbeeldingslink, of laat leeg voor upload vanaf toestel.`,
      photoInitial || ""
    );
    if (photoValue === null) return null;
    photoUrl = photoValue.trim();

    if (!photoUrl) {
      const wantsUpload = window.confirm("Wil je nu een foto kiezen vanaf je toestel?");
      if (wantsUpload) {
        const uploadedPhotoDataUrl = await pickImageFromDevice();
        if (uploadedPhotoDataUrl) {
          photoUrl = uploadedPhotoDataUrl;
        }
      }
    }
  }

  let priceLabel = "";
  if (includePrice) {
    const priceValue = window.prompt(
      `${title}\nPrijs per nacht of totaal (optioneel, bv. €80)`,
      priceInitial || ""
    );
    if (priceValue === null) return null;
    priceLabel = priceValue.trim();
  }

  return {
    name: trimmedName,
    address: addressValue.trim(),
    mapsLink: mapsLinkValue,
    websiteUrl,
    photoUrl,
    priceLabel
  };
}

async function pickImageFromDevice() {
  const picker = el.photoPicker;
  if (!picker) return "";

  return new Promise((resolve) => {
    const cleanup = () => {
      picker.removeEventListener("change", onChange);
      window.removeEventListener("focus", onFocusFallback);
      picker.value = "";
    };

    const onChange = () => {
      const file = picker.files && picker.files[0];
      if (!file) {
        cleanup();
        resolve("");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        cleanup();
        resolve(typeof reader.result === "string" ? reader.result : "");
      };
      reader.onerror = () => {
        cleanup();
        resolve("");
      };
      reader.readAsDataURL(file);
    };

    // If user cancels picker, focus returns without change event.
    const onFocusFallback = () => {
      setTimeout(() => {
        if (!picker.files || !picker.files.length) {
          cleanup();
          resolve("");
        }
      }, 200);
    };

    picker.addEventListener("change", onChange, { once: true });
    window.addEventListener("focus", onFocusFallback, { once: true });
    picker.click();
  });
}

function removeCountry(countryId) {
  const placeIds = state.data.places.filter((p) => p.countryId === countryId).map((p) => p.id);
  state.data.countries = state.data.countries.filter((c) => c.id !== countryId);
  state.data.places = state.data.places.filter((p) => p.countryId !== countryId);
  state.data.activities = state.data.activities.filter((a) => !placeIds.includes(a.placeId));
  state.data.hotels = state.data.hotels.filter((h) => !placeIds.includes(h.placeId));

  if (state.selectedCountryId === countryId) state.selectedCountryId = null;
  if (state.selectedPlaceId && placeIds.includes(state.selectedPlaceId)) state.selectedPlaceId = null;
  if (state.pendingPinTarget && placeIds.includes(state.pendingPinTarget.id)) state.pendingPinTarget = null;
}

function removePlace(placeId) {
  const removedActivityIds = state.data.activities.filter((a) => a.placeId === placeId).map((a) => a.id);
  const removedHotelIds = state.data.hotels.filter((h) => h.placeId === placeId).map((h) => h.id);

  state.data.places = state.data.places.filter((p) => p.id !== placeId);
  state.data.activities = state.data.activities.filter((a) => a.placeId !== placeId);
  state.data.hotels = state.data.hotels.filter((h) => h.placeId !== placeId);

  if (state.selectedPlaceId === placeId) state.selectedPlaceId = null;
  if (state.pendingPinTarget?.kind === "place" && state.pendingPinTarget.id === placeId) state.pendingPinTarget = null;
  if (state.pendingPinTarget?.kind === "activity" && removedActivityIds.includes(state.pendingPinTarget.id)) state.pendingPinTarget = null;
  if (state.pendingPinTarget?.kind === "hotel" && removedHotelIds.includes(state.pendingPinTarget.id)) state.pendingPinTarget = null;
}

function promptInput(title, label, onConfirm, initialValue = "") {
  // iOS standalone/PWA heeft soms focusproblemen met <dialog>; native prompt is daar stabieler.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isIOS || isStandalone) {
    const fallbackValue = window.prompt(`${title}\n${label}`, initialValue);
    if (!fallbackValue) return;
    const trimmed = fallbackValue.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    return;
  }

  if (!el.inputDialog || typeof el.inputDialog.showModal !== "function") {
    const fallbackValue = window.prompt(`${title}\n${label}`, initialValue);
    if (!fallbackValue) return;
    const trimmed = fallbackValue.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    return;
  }

  el.dialogTitle.textContent = title;
  el.fieldLabel.textContent = label;
  el.fieldValue.value = initialValue;
  try {
    el.inputDialog.showModal();
  } catch {
    const fallbackValue = window.prompt(`${title}\n${label}`, initialValue);
    if (!fallbackValue) return;
    const trimmed = fallbackValue.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    return;
  }
  el.fieldValue.focus();

  const cancelHandler = () => {
    el.inputDialog.close("cancel");
  };
  el.cancelBtn?.addEventListener("click", cancelHandler, { once: true });

  const handler = (event) => {
    event.preventDefault();
    const value = el.fieldValue.value.trim();
    if (!value) return;
    onConfirm(value);
    el.inputDialog.close("confirm");
    el.inputForm.removeEventListener("submit", handler);
  };

  el.inputForm.addEventListener("submit", handler);
  el.inputDialog.addEventListener(
    "close",
    () => {
      el.inputForm.removeEventListener("submit", handler);
      el.cancelBtn?.removeEventListener("click", cancelHandler);
    },
    { once: true }
  );
}

function migrateMissingSortOrders(data) {
  function assignForGroup(items, keyFn) {
    const groups = new Map();
    for (const item of items) {
      const key = keyFn(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    for (const list of groups.values()) {
      let max = 0;
      for (const item of list) {
        const s = item.sortOrder;
        if (typeof s === "number" && Number.isFinite(s)) max = Math.max(max, s);
      }
      let seq = max + 1;
      for (const item of list) {
        const s = item.sortOrder;
        if (typeof s !== "number" || !Number.isFinite(s)) {
          item.sortOrder = seq++;
        }
      }
    }
  }
  assignForGroup(data.places, (p) => p.countryId);
  assignForGroup(data.activities, (a) => a.placeId);
  assignForGroup(data.hotels, (h) => h.placeId);
}

function nextPlaceSortOrder(countryId) {
  const list = state.data.places.filter((p) => p.countryId === countryId);
  return list.reduce((m, p) => Math.max(m, sortOrderValue(p)), 0) + 1;
}

function nextActivitySortOrder(placeId) {
  const list = state.data.activities.filter((a) => a.placeId === placeId);
  return list.reduce((m, a) => Math.max(m, sortOrderValue(a)), 0) + 1;
}

function nextHotelSortOrder(placeId) {
  const list = state.data.hotels.filter((h) => h.placeId === placeId);
  return list.reduce((m, h) => Math.max(m, sortOrderValue(h)), 0) + 1;
}

function normalizeStayDays(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    if (n >= 1 && n <= 366) return n;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = parseInt(raw.trim(), 10);
    if (Number.isFinite(n) && n >= 1 && n <= 366) return n;
  }
  return null;
}

function parseOptionalStayDays(str) {
  const t = String(str).trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n) || n < 1 || n > 366) return null;
  return n;
}

function formatPlaceStayDaysLine(stayDays) {
  if (typeof stayDays === "number" && Number.isFinite(stayDays) && stayDays >= 1) {
    const n = String(stayDays);
    return `<span class="place-days-inner"><span class="place-days-k">Dagen</span><span class="place-days-sep">·</span><span class="place-days-n">${escapeHtml(n)}</span></span>`;
  }
  return `<span class="place-days-inner place-days-inner--muted"><span class="place-days-k">Dagen</span><span class="place-days-sep">·</span><span class="place-days-n">—</span></span>`;
}

function isAppCompletelyEmpty(data) {
  return data.countries.length === 0
    && data.places.length === 0
    && data.activities.length === 0
    && data.hotels.length === 0;
}

function normalizePlaceNameForMatch(name) {
  return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function pickBestPlaceCandidate(candidates, data) {
  if (!candidates.length) return null;
  const countryIds = new Set(data.countries.map((c) => c.id));
  let list = candidates.filter((p) => countryIds.has(p.countryId));
  if (!list.length) list = [...candidates];
  list.sort((a, b) => sortOrderValue(a) - sortOrderValue(b)
    || (a.name || "").localeCompare(b.name || "", "nl", { sensitivity: "base" }));
  return list[0];
}

function recoverMissingCountries(data) {
  const countryIds = new Set(data.countries.map((c) => c.id));
  let changed = false;
  const needed = [...new Set(data.places.map((p) => p.countryId).filter(Boolean))];
  for (const cid of needed) {
    if (!countryIds.has(cid)) {
      data.countries.push({ id: cid, name: "Hersteld (oude plekken)", heroImageUrl: "" });
      countryIds.add(cid);
      changed = true;
    }
  }
  return changed;
}

function reattachOrphanItemsByOldPlaceNames(data, rawPlaces) {
  const metaById = new Map();
  for (const p of rawPlaces) {
    if (p && p.id) metaById.set(p.id, { name: String(p.name || "").trim() });
  }
  let changed = false;
  const relinkOne = (item) => {
    const validIds = new Set(data.places.map((place) => place.id));
    if (validIds.has(item.placeId)) return;
    const meta = metaById.get(item.placeId);
    if (meta && meta.name) {
      const n = normalizePlaceNameForMatch(meta.name);
      const candidates = data.places.filter(
        (place) => normalizePlaceNameForMatch(place.name) === n
      );
      if (candidates.length) {
        const chosen = pickBestPlaceCandidate(candidates, data);
        if (chosen) {
          item.placeId = chosen.id;
          changed = true;
          return;
        }
      }
    }
    const addr = (item.address || "").toLowerCase();
    const addrMatches = data.places.filter(
      (place) => (place.name || "").length >= 3
        && addr.includes((place.name || "").toLowerCase())
    );
    if (addrMatches.length === 1) {
      item.placeId = addrMatches[0].id;
      changed = true;
    } else if (addrMatches.length > 1) {
      const chosen = pickBestPlaceCandidate(addrMatches, data);
      if (chosen) {
        item.placeId = chosen.id;
        changed = true;
      }
    }
  };
  for (const activity of data.activities) relinkOne(activity);
  for (const hotel of data.hotels) relinkOne(hotel);
  return changed;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: emptyData(), repaired: false };
    const parsed = JSON.parse(raw);
    return normalizeData(parsed);
  } catch {
    return { data: emptyData(), repaired: false };
  }
}

function normalizeData(parsed) {
  const rawPlaces = Array.isArray(parsed.places) ? parsed.places : [];
  const base = emptyData();
  base.countries = Array.isArray(parsed.countries)
    ? parsed.countries.map((c) => ({
      ...c,
      name: typeof c.name === "string" && c.name.trim() ? c.name.trim() : "Land",
      heroImageUrl: typeof c.heroImageUrl === "string" ? c.heroImageUrl.trim() : "",
      routeKmManual: normalizeOptionalKmValue(c.routeKmManual),
      budgetHotels: normalizeBudgetValue(c.budgetHotels),
      budgetActivities: normalizeBudgetValue(c.budgetActivities),
      budgetOther: normalizeBudgetValue(c.budgetOther)
    }))
    : [];
  base.places = Array.isArray(parsed.places) ? parsed.places.map((place) => ({
    ...place,
    sortOrder: typeof place.sortOrder === "number" && Number.isFinite(place.sortOrder) ? place.sortOrder : undefined,
    stayDays: normalizeStayDays(place.stayDays),
    latitude: typeof place.latitude === "number" ? place.latitude : null,
    longitude: typeof place.longitude === "number" ? place.longitude : null
  })) : [];
  base.activities = Array.isArray(parsed.activities) ? parsed.activities.map((activity) => ({
    notes: "",
    date: null,
    address: "",
    mapsLink: "",
    photoUrl: "",
    latitude: null,
    longitude: null,
    ...activity,
    sortOrder: typeof activity.sortOrder === "number" && Number.isFinite(activity.sortOrder) ? activity.sortOrder : undefined,
    address: typeof activity.address === "string" ? activity.address : "",
    mapsLink: typeof activity.mapsLink === "string" ? activity.mapsLink : "",
    photoUrl: typeof activity.photoUrl === "string" ? activity.photoUrl : "",
    latitude: typeof activity.latitude === "number" ? activity.latitude : null,
    longitude: typeof activity.longitude === "number" ? activity.longitude : null
  })) : [];
  base.hotels = Array.isArray(parsed.hotels) ? parsed.hotels.map((hotel) => ({
    address: "",
    mapsLink: "",
    websiteUrl: "",
    photoUrl: "",
    priceLabel: "",
    latitude: null,
    longitude: null,
    ...hotel,
    sortOrder: typeof hotel.sortOrder === "number" && Number.isFinite(hotel.sortOrder) ? hotel.sortOrder : undefined,
    address: typeof hotel.address === "string" ? hotel.address : "",
    mapsLink: typeof hotel.mapsLink === "string" ? hotel.mapsLink : "",
    websiteUrl: typeof hotel.websiteUrl === "string" ? hotel.websiteUrl : "",
    photoUrl: typeof hotel.photoUrl === "string" ? hotel.photoUrl : "",
    priceLabel: typeof hotel.priceLabel === "string" ? hotel.priceLabel : "",
    latitude: typeof hotel.latitude === "number" ? hotel.latitude : null,
    longitude: typeof hotel.longitude === "number" ? hotel.longitude : null
  })) : [];
  migrateMissingSortOrders(base);
  let repaired = false;
  if (recoverMissingCountries(base)) repaired = true;
  if (reattachOrphanItemsByOldPlaceNames(base, rawPlaces)) repaired = true;
  if (backfillCoordinatesFromExistingMapsLinks(base)) repaired = true;
  if (backfillKnownLandmarkCoordinates(base)) repaired = true;
  if (backfillPlaceCoordinatesFromItems(base)) repaired = true;
  if (mergeSampleIcelandIfMissing(base)) repaired = true;
  return { data: base, repaired };
}

function normalizeLandmarkText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isBigBenReference(text) {
  const t = normalizeLandmarkText(text);
  return t.includes("big ben") || t.includes("big ban");
}

function backfillKnownLandmarkCoordinates(data) {
  let changed = false;
  const BIG_BEN = { latitude: 51.500729, longitude: -0.124625 };
  const MAX_BIG_BEN_DISTANCE_KM = 3;
  const shouldSnapToBigBen = (item) => {
    if (!hasCoordinates(item)) return true;
    const dist = distanceKm(item.latitude, item.longitude, BIG_BEN.latitude, BIG_BEN.longitude);
    return !Number.isFinite(dist) || dist > MAX_BIG_BEN_DISTANCE_KM;
  };
  for (const place of data.places) {
    const maybeBigBen = isBigBenReference(place.name);
    if (!maybeBigBen || !shouldSnapToBigBen(place)) continue;
    place.latitude = BIG_BEN.latitude;
    place.longitude = BIG_BEN.longitude;
    changed = true;
  }
  for (const activity of data.activities) {
    const maybeBigBen = isBigBenReference(activity.title) || isBigBenReference(activity.address);
    if (!maybeBigBen || !shouldSnapToBigBen(activity)) continue;
    activity.latitude = BIG_BEN.latitude;
    activity.longitude = BIG_BEN.longitude;
    changed = true;
  }
  for (const hotel of data.hotels) {
    const maybeBigBen = isBigBenReference(hotel.name) || isBigBenReference(hotel.address);
    if (!maybeBigBen || !shouldSnapToBigBen(hotel)) continue;
    hotel.latitude = BIG_BEN.latitude;
    hotel.longitude = BIG_BEN.longitude;
    changed = true;
  }
  return changed;
}

function distanceKm(lat1, lon1, lat2, lon2) {
  if (![lat1, lon1, lat2, lon2].every((n) => typeof n === "number" && Number.isFinite(n))) return NaN;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function backfillCoordinatesFromExistingMapsLinks(data) {
  let changed = false;
  for (const activity of data.activities) {
    if (hasCoordinates(activity)) continue;
    const parsed = extractCoordinatesFromGoogleMapsLink(activity.mapsLink || "");
    if (!parsed) continue;
    activity.latitude = parsed.latitude;
    activity.longitude = parsed.longitude;
    changed = true;
  }
  for (const hotel of data.hotels) {
    if (hasCoordinates(hotel)) continue;
    const parsed =
      extractCoordinatesFromGoogleMapsLink(hotel.mapsLink || "")
      || extractCoordinatesFromGoogleMapsLink(hotel.websiteUrl || "");
    if (!parsed) continue;
    hotel.latitude = parsed.latitude;
    hotel.longitude = parsed.longitude;
    changed = true;
  }
  return changed;
}

function backfillPlaceCoordinatesFromItems(data) {
  let changed = false;
  for (const place of data.places) {
    if (hasCoordinates(place)) continue;
    const activityWithCoords = data.activities.find((a) => a.placeId === place.id && hasCoordinates(a));
    if (activityWithCoords) {
      place.latitude = activityWithCoords.latitude;
      place.longitude = activityWithCoords.longitude;
      changed = true;
      continue;
    }
    const hotelWithCoords = data.hotels.find((h) => h.placeId === place.id && hasCoordinates(h));
    if (hotelWithCoords) {
      place.latitude = hotelWithCoords.latitude;
      place.longitude = hotelWithCoords.longitude;
      changed = true;
    }
  }
  return changed;
}

function emptyData() {
  return {
    countries: [],
    places: [],
    activities: [],
    hotels: []
  };
}

function countryNameIsIceland(name) {
  const t = String(name || "").trim().toLowerCase();
  return t === "ijsland" || t === "iceland" || t === "ísland";
}

function dataHasIcelandCountry(data) {
  return data.countries.some((c) => countryNameIsIceland(c.name));
}

/** Voegt standaard IJsland-route toe (alleen data-mutatie). */
function pushIcelandSampleTripInto(data) {
  const iceland = { id: uid(), name: "IJsland", heroImageUrl: "" };
  const rows = [
    { type: "city", name: "Reykjavik", latitude: 64.1355, longitude: -21.8954, stayDays: 2 },
    { type: "area", name: "Vík", latitude: 63.4194, longitude: -18.9958, stayDays: 2 },
    { type: "city", name: "Höfn", latitude: 64.2539, longitude: -15.2082, stayDays: 1 },
    { type: "area", name: "Egilsstaðir", latitude: 65.2619, longitude: -14.4048, stayDays: 1 },
    { type: "city", name: "Akureyri", latitude: 65.6815, longitude: -18.0907, stayDays: 2 },
    { type: "area", name: "Snæfellsnes", latitude: 64.8075, longitude: -23.7732, stayDays: 1 }
  ];
  const places = rows.map((row, index) => ({
    id: uid(),
    countryId: iceland.id,
    type: row.type,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    stayDays: row.stayDays,
    sortOrder: index
  }));
  const reykjavik = places[0];
  data.countries.push(iceland);
  data.places.push(...places);
  data.activities.push({
    id: uid(),
    placeId: reykjavik.id,
    title: "Hallgrímskirkja & binnenstad",
    notes: "",
    date: null,
    address: "Reykjavik",
    mapsLink: "",
    photoUrl: "https://images.unsplash.com/photo-1504893524553-b855bce32c67?w=200&q=80",
    latitude: 64.1414,
    longitude: -21.9267,
    sortOrder: 0
  });
  data.hotels.push({
    id: uid(),
    placeId: reykjavik.id,
    name: "Hotel Reykjavik Centrum",
    address: "Centrum",
    mapsLink: "https://www.google.com/maps/search/?api=1&query=Hotel+Reykjavik+Centrum+Iceland",
    websiteUrl: "",
    photoUrl: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=200&q=80",
    priceLabel: "€95",
    latitude: 64.1473,
    longitude: -21.9426,
    sortOrder: 0
  });
}

/**
 * Bestaande installs (alleen Thailand e.d.) krijgen één keer demo-IJsland.
 * Als je IJsland bewust verwijdert, komt het niet terug (localStorage-vlag).
 */
function mergeSampleIcelandIfMissing(data) {
  if (dataHasIcelandCountry(data)) {
    try {
      localStorage.setItem(ICELAND_SAMPLE_LS_KEY, "1");
    } catch {
      /* ignore */
    }
    return false;
  }
  let skip = false;
  try {
    skip = localStorage.getItem(ICELAND_SAMPLE_LS_KEY) === "1";
  } catch {
    skip = false;
  }
  if (skip) return false;
  pushIcelandSampleTripInto(data);
  try {
    localStorage.setItem(ICELAND_SAMPLE_LS_KEY, "1");
  } catch {
    /* zonder vlag kan bij volgende load dubbel — zeldzaam */
  }
  return true;
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  renderAll();
  void pushCloudSyncIfConnected();
}

function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.blobId || !parsed.passphrase) return null;
    return {
      blobId: String(parsed.blobId),
      passphrase: String(parsed.passphrase)
    };
  } catch {
    return null;
  }
}

function saveSyncConfig(config) {
  if (!config) {
    localStorage.removeItem(SYNC_CONFIG_KEY);
    return;
  }
  localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
}

function startCloudSyncPolling() {
  if (state.syncPollTimer) clearInterval(state.syncPollTimer);
  state.syncPollTimer = setInterval(() => {
    void pullCloudSyncIfConnected();
  }, 30000);
  window.addEventListener("online", () => {
    void pullCloudSyncIfConnected();
  });
}

async function createCloudSyncChannel() {
  const passphrase = window.prompt("Kies een sync-wachtwoord (gebruik exact hetzelfde op iPhone):", "");
  if (passphrase === null) return;
  const clean = passphrase.trim();
  if (!clean) {
    window.alert("Sync-wachtwoord is verplicht.");
    return;
  }
  try {
    const packed = await packEncryptedCloudPayload(state.data, clean);
    const response = await fetch(CLOUD_SYNC_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packed)
    });
    if (!response.ok) {
      window.alert("Sync-kanaal maken mislukt.");
      return;
    }
    const loc = response.headers.get("Location") || "";
    const blobId = extractBlobId(loc);
    if (!blobId) {
      window.alert("Sync-kanaal gemaakt, maar code kon niet worden gelezen.");
      return;
    }
    state.syncConfig = { blobId, passphrase: clean };
    saveSyncConfig(state.syncConfig);
    const shareText = `Sync code: ${blobId}\nWachtwoord: ${clean}`;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(shareText);
      window.alert("Cloud sync actief. Sync-code + wachtwoord zijn gekopieerd; vul die op je iPhone in bij Cloud sync > 2.");
    } else {
      window.prompt("Bewaar deze sync-code + wachtwoord en vul op iPhone in:", shareText);
    }
    state.locationStatusMessage = "Cloud sync kanaal actief.";
    renderMap();
  } catch {
    window.alert("Cloud sync kanaal maken mislukt.");
  }
}

async function connectToCloudSyncChannel() {
  const blobId = window.prompt("Vul sync-code in:", "");
  if (blobId === null) return;
  const passphrase = window.prompt("Vul sync-wachtwoord in:", "");
  if (passphrase === null) return;
  const id = blobId.trim();
  const pw = passphrase.trim();
  if (!id || !pw) {
    window.alert("Sync-code en wachtwoord zijn verplicht.");
    return;
  }
  state.syncConfig = { blobId: id, passphrase: pw };
  saveSyncConfig(state.syncConfig);
  await pullCloudSyncIfConnected(true);
}

function extractBlobId(locationHeader) {
  const t = String(locationHeader || "").trim();
  if (!t) return "";
  const parts = t.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

async function pushCloudSyncIfConnected() {
  if (!state.syncConfig || state.syncInFlight) return;
  const now = Date.now();
  if (now - state.lastCloudSyncAt < 2000) return;
  state.syncInFlight = true;
  try {
    const packed = await packEncryptedCloudPayload(state.data, state.syncConfig.passphrase);
    const response = await fetch(`${CLOUD_SYNC_BASE_URL}/${encodeURIComponent(state.syncConfig.blobId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packed)
    });
    if (response.ok) {
      state.lastCloudSyncAt = Date.now();
    }
  } catch {
    // Best effort sync; local app keeps working.
  } finally {
    state.syncInFlight = false;
  }
}

async function pullCloudSyncIfConnected(showMessage = false) {
  if (!state.syncConfig || state.syncInFlight) return;
  state.syncInFlight = true;
  try {
    const response = await fetch(`${CLOUD_SYNC_BASE_URL}/${encodeURIComponent(state.syncConfig.blobId)}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      if (showMessage) window.alert("Cloud sync ophalen mislukt.");
      return;
    }
    const packed = await response.json();
    const remote = await unpackEncryptedCloudPayload(packed, state.syncConfig.passphrase);
    if (!remote || typeof remote !== "object") {
      if (showMessage) window.alert("Cloud data kon niet worden gelezen.");
      return;
    }
    const normalized = normalizeData(remote);
    state.data = normalized.data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    state.selectedCountryId = null;
    state.selectedPlaceId = null;
    state.locationStatusMessage = "Cloud sync bijgewerkt.";
    renderAll();
    state.lastCloudSyncAt = Date.now();
    if (showMessage) window.alert("Cloud sync gelukt.");
  } catch {
    if (showMessage) window.alert("Cloud sync ophalen mislukt.");
  } finally {
    state.syncInFlight = false;
  }
}

async function packEncryptedCloudPayload(data, passphrase) {
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveSyncKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return {
    v: 1,
    updatedAt: Date.now(),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    payload: bytesToBase64(new Uint8Array(cipher))
  };
}

async function unpackEncryptedCloudPayload(packed, passphrase) {
  if (!packed || packed.v !== 1 || !packed.salt || !packed.iv || !packed.payload) return null;
  const salt = base64ToBytes(packed.salt);
  const iv = base64ToBytes(packed.iv);
  const cipher = base64ToBytes(packed.payload);
  const key = await deriveSyncKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  const text = new TextDecoder().decode(plain);
  return JSON.parse(text);
}

async function deriveSyncKey(passphrase, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function bytesToBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(base64) {
  const bin = atob(String(base64 || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function seedData() {
  const thailand = { id: uid(), name: "Thailand", heroImageUrl: "" };
  const rows = [
    { type: "city", name: "Bangkok", latitude: 13.7563, longitude: 100.5018, stayDays: 2 },
    { type: "city", name: "Chiang Mai", latitude: 18.7883, longitude: 98.9853, stayDays: 3 },
    { type: "area", name: "Khao Sok", latitude: 8.9147, longitude: 98.5298, stayDays: 2 },
    { type: "area", name: "Phuket", latitude: 7.8804, longitude: 98.3923, stayDays: 4 },
    { type: "area", name: "Phi Phi Island", latitude: 7.7407, longitude: 98.7784, stayDays: 2 },
    { type: "area", name: "Krabi", latitude: 8.0863, longitude: 98.9063, stayDays: 3 }
  ];
  const places = rows.map((row, index) => ({
    id: uid(),
    countryId: thailand.id,
    type: row.type,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    stayDays: row.stayDays,
    sortOrder: index
  }));
  const bangkok = places[0];

  state.data.countries.push(thailand);
  state.data.places.push(...places);
  state.data.activities.push({
    id: uid(),
    placeId: bangkok.id,
    title: "Grand Palace",
    notes: "",
    date: null,
    address: "Na Phra Lan Rd, Phra Nakhon, Bangkok 10200, Thailand",
    mapsLink: "",
    photoUrl:
      "https://images.unsplash.com/photo-1528181304800-259b08848526?w=200&q=80",
    latitude: 13.7500,
    longitude: 100.4913,
    sortOrder: 0
  });
  state.data.hotels.push({
    id: uid(),
    placeId: bangkok.id,
    name: "River View Hotel",
    address: "Riverside",
    mapsLink: "https://www.google.com/maps/search/?api=1&query=River%20View%20Hotel%20Bangkok",
    websiteUrl: "",
    photoUrl:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200&q=80",
    priceLabel: "€80",
    latitude: null,
    longitude: null,
    sortOrder: 0
  });

  pushIcelandSampleTripInto(state.data);

  try {
    localStorage.setItem(ICELAND_SAMPLE_LS_KEY, "1");
  } catch {
    /* ignore */
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function registerServiceWorker() {
  const hadSwController = Boolean(navigator.serviceWorker && navigator.serviceWorker.controller);

  if ("serviceWorker" in navigator) {
    let reloadScheduled = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadSwController || reloadScheduled) return;
      reloadScheduled = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: "none" })
      .then((reg) => {
        void reg.update();
      })
      .catch(() => null);
  }

  window.addEventListener("online", () => {
    el.offlineBadge.textContent = `online v${APP_VERSION}`;
  });
  window.addEventListener("offline", () => {
    el.offlineBadge.textContent = `offline v${APP_VERSION}`;
  });
  el.offlineBadge.textContent = `${navigator.onLine ? "online" : "offline"} v${APP_VERSION}`;
}

function hasCoordinates(item) {
  return typeof item.latitude === "number" && typeof item.longitude === "number";
}

function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

function uid() {
  return crypto.randomUUID();
}

function byName(field) {
  return (a, b) => (a[field] || "").localeCompare((b[field] || ""), "nl", { sensitivity: "base" });
}

function sortOrderValue(item) {
  const s = item.sortOrder;
  return typeof s === "number" && Number.isFinite(s) ? s : 0;
}

function bySortOrderThenName(a, b) {
  const ao = sortOrderValue(a);
  const bo = sortOrderValue(b);
  if (ao !== bo) return ao - bo;
  return (a.name || "").localeCompare(b.name || "", "nl", { sensitivity: "base" });
}

function bySortOrderThenActivityTitle(a, b) {
  const ao = sortOrderValue(a);
  const bo = sortOrderValue(b);
  if (ao !== bo) return ao - bo;
  return (a.title || "").localeCompare(b.title || "", "nl", { sensitivity: "base" });
}

function bySortOrderThenHotelName(a, b) {
  const ao = sortOrderValue(a);
  const bo = sortOrderValue(b);
  if (ao !== bo) return ao - bo;
  return (a.name || "").localeCompare(b.name || "", "nl", { sensitivity: "base" });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;");
}

function truncateForDisplay(str, max) {
  const s = String(str);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function isSafeWebUrl(url) {
  return /^https?:\/\//i.test(String(url || "").trim());
}

function formatHotelWebsiteRow(websiteUrl) {
  const raw = websiteUrl && String(websiteUrl).trim();
  if (!raw) {
    return "Geen hotelwebsite — voeg bij Bewerk een site- of bookinglink toe.";
  }
  if (isSafeWebUrl(raw)) {
    const display = truncateForDisplay(raw, 72);
    return `<span class="meta">Hotel: </span><a class="inline-link" href="${escapeAttr(raw)}" target="_blank" rel="noopener noreferrer">${escapeHtml(display)}</a>`;
  }
  return escapeHtml(raw);
}

function formatHotelMapsRow(mapsLink) {
  const raw = mapsLink && String(mapsLink).trim();
  if (!raw) return "";
  if (isSafeWebUrl(raw)) {
    const display = truncateForDisplay(raw, 72);
    return `<span class="meta">Google Maps: </span><a class="inline-link" href="${escapeAttr(raw)}" target="_blank" rel="noopener noreferrer">${escapeHtml(display)}</a>`;
  }
  return `<span class="meta">Google Maps: </span>${escapeHtml(truncateForDisplay(raw, 72))}`;
}

function encodeDataForSyncLink(data) {
  const json = JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeDataFromSyncLink(encoded) {
  const json = decodeURIComponent(escape(atob(encoded)));
  return JSON.parse(json);
}

function maybeImportDataFromSyncHash() {
  const rawHash = String(window.location.hash || "");
  if (!rawHash.startsWith("#sync=")) return;
  const encoded = rawHash.slice(6).trim();
  if (!encoded) return;
  try {
    const parsed = decodeDataFromSyncLink(encoded);
    const normalized = normalizeData(parsed);
    state.data = normalized.data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    state.selectedCountryId = null;
    state.selectedPlaceId = null;
    state.locationStatusMessage = "Data gesynchroniseerd vanaf sync-link.";
    history.replaceState(null, "", `${window.location.origin}${window.location.pathname}`);
  } catch {
    state.locationStatusMessage = "Sync-link kon niet worden ingelezen.";
    history.replaceState(null, "", `${window.location.origin}${window.location.pathname}`);
  }
}


