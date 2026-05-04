const STORAGE_KEY = "vacation_planner_v1";
/** Zelfde nummer als in index.html (`app.js?v=`) en sw.js (cache + assets). */
const APP_VERSION = 27;

const __loaded = loadData();
const state = {
  data: __loaded.data,
  selectedCountryId: null,
  selectedPlaceId: null,
  pendingPinTarget: null,
  locationStatusMessage: ""
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

const el = {
  main: document.querySelector("main.container"),
  tripStack: document.getElementById("tripStack"),
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
  offlineBadge: document.getElementById("offlineBadge"),
  placeMap: document.getElementById("placeMap"),
  mapHint: document.getElementById("mapHint")
};

boot();

function boot() {
  if (isAppCompletelyEmpty(state.data)) {
    seedData();
  }
  if (!state.selectedCountryId && state.data.countries.length) {
    state.selectedCountryId = [...state.data.countries].sort(byName("name"))[0].id;
  }
  wireEvents();
  renderAll();
  registerServiceWorker();
}

function wireEvents() {
  el.addCountryBtn.addEventListener("click", () => {
    promptInput("Nieuw land", "Landnaam", (value) => {
      state.data.countries.push({ id: uid(), name: value.trim() });
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
      websiteBeforeMaps: true
    });
    if (!payload) return;

    const newHotel = {
      id: uid(),
      placeId: state.selectedPlaceId,
      name: payload.name,
      address: payload.address,
      mapsLink: payload.mapsLink,
      websiteUrl: payload.websiteUrl ?? "",
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
}

function renderAll() {
  updateTripLayout();
  renderCountries();
  renderPlaces();
  renderItems();
  renderMap();
  updateButtons();
}

function updateTripLayout() {
  if (el.tripStack) {
    el.tripStack.hidden = state.data.countries.length === 0;
  }
  el.main?.classList.toggle("multi-land", state.data.countries.length > 1);
}

function renderCountries() {
  const countries = [...state.data.countries].sort(byName("name"));
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
      state.selectedPlaceId = null;
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

function renderPlaces() {
  const country = state.data.countries.find((c) => c.id === state.selectedCountryId);
  el.countryTitle.textContent = country ? `${country.name}: Plaatsen` : "Plaatsen";

  const places = state.data.places
    .filter((p) => p.countryId === state.selectedCountryId)
    .sort(bySortOrderThenName);

  if (places.length && !places.some((p) => p.id === state.selectedPlaceId)) {
    state.selectedPlaceId = places[0].id;
  }
  if (!places.length) {
    state.selectedPlaceId = null;
  }

  renderPlaceList(el.placesList, places);
}

function renderPlaceList(target, places) {
  target.innerHTML = "";
  if (!places.length) {
    target.innerHTML = `<li><span class="meta">Nog leeg</span></li>`;
    return;
  }

  places.forEach((place) => {
    const li = document.createElement("li");
    const typeLabel = place.type === "city" ? "Stad" : "Gebied";
    const daysLine = formatPlaceStayDaysLine(place.stayDays);
    li.innerHTML = `
      <div class="place-row-left">
        <div class="place-days">${daysLine}</div>
        <span class="name ${state.selectedPlaceId === place.id ? "active" : ""}" data-id="${place.id}">${escapeHtml(place.name)} <span class="meta">(${typeLabel})</span></span>
      </div>
      <div class="row-actions">
        <button data-edit-place="${place.id}">Bewerk</button>
        <button class="danger" data-delete-place="${place.id}">Verwijder</button>
      </div>
    `;

    li.addEventListener("click", (event) => {
      if (event.target.closest(".row-actions")) return;
      state.selectedPlaceId = place.id;
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
  const place = state.data.places.find((p) => p.id === state.selectedPlaceId);
  const placeName = place ? place.name : "—";
  el.activitiesCardTitle.textContent = place ? `${placeName}: activiteiten` : "Activiteiten";
  el.hotelsCardTitle.textContent = place ? `${placeName}: hotels` : "Hotels";
  if (el.activitiesCardHint) {
    el.activitiesCardHint.textContent = place
      ? "Plak een Google Maps-link met coördinaten in het Maps-veld — dan verschijnt de pin automatisch op de kaart (kaart onderaan)."
      : "Kies een plaats in de route hierboven.";
  }
  if (el.hotelsCardHint) {
    el.hotelsCardHint.textContent = place
      ? "Zet eerst je hotelwebsite; daarna een Google Maps-link — als daar coördinaten in zitten, komt de pin automatisch op de kaart (ook als de Maps-URL bij website stond)."
      : "Kies een plaats in de route hierboven.";
  }

  const activities = state.data.activities
    .filter((a) => a.placeId === state.selectedPlaceId)
    .sort(bySortOrderThenActivityTitle);
  const hotels = state.data.hotels
    .filter((h) => h.placeId === state.selectedPlaceId)
    .sort(bySortOrderThenHotelName);

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
    const addressText = activity.address ? escapeHtml(activity.address) : "geen adres";
    const linkText = activity.mapsLink ? "maps-link" : "geen link";
    const photoText = activity.photoUrl ? "foto" : "geen foto";
    const hasPinText = hasCoordinates(activity) ? "pin aanwezig" : "geen pin";

    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div>${escapeHtml(activity.title)}</div>
        <div class="meta">${addressText} · ${linkText} · ${photoText} · ${hasPinText}</div>
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
      activity.photoUrl = payload.photoUrl;

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

  hotels.forEach((hotel) => {
    const addressText = hotel.address ? escapeHtml(hotel.address) : "geen adres";
    const mapsMeta = hotel.mapsLink ? "Maps-link" : "geen Maps-link";
    const hasPinText = hasCoordinates(hotel) ? "pin op kaart" : "geen pin";
    const websiteRow = formatHotelWebsiteRow(hotel.websiteUrl);
    const mapsRow = formatHotelMapsRow(hotel.mapsLink);

    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <div>${escapeHtml(hotel.name)}</div>
        <div class="meta">${addressText} · ${mapsMeta} · ${hasPinText}</div>
        <div class="meta hotel-link-row">${websiteRow}</div>
        ${mapsRow ? `<div class="meta hotel-link-row">${mapsRow}</div>` : ""}
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
        websiteBeforeMaps: true
      });
      if (!payload) return;

      hotel.name = payload.name;
      hotel.address = payload.address;
      hotel.mapsLink = payload.mapsLink;
      hotel.websiteUrl = payload.websiteUrl ?? "";

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
  if (state.selectedPlaceId) return;
  const firstPlace = state.data.places
    .filter((p) => p.countryId === state.selectedCountryId)
    .sort(bySortOrderThenName)[0];
  if (firstPlace) {
    state.selectedPlaceId = firstPlace.id;
    renderAll();
  }
}

function renderMap() {
  if (!el.placeMap) return;
  if (!window.L) {
    el.mapHint.textContent = "Kaart kon niet geladen worden.";
    return;
  }

  if (!map) {
    map = L.map(el.placeMap).setView([20, 0], 2);
    const cartoLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap &copy; CARTO"
    });
    const osmFallbackLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    });

    cartoLayer.on("tileerror", () => {
      // Fallback for reliability when CARTO tiles fail.
      if (!map.hasLayer(osmFallbackLayer)) {
        map.addLayer(osmFallbackLayer);
      }
    });

    cartoLayer.addTo(map);

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

  const countryPlacesAll = state.data.places
    .filter((p) => p.countryId === state.selectedCountryId)
    .filter(hasCoordinates);
  const countryPlacesOnMap = countryPlacesAll.filter((p) => p.type !== "city");

  const selectedPlaceActivities = state.data.activities
    .filter((a) => a.placeId === state.selectedPlaceId)
    .filter(hasCoordinates);

  const selectedPlaceHotels = state.data.hotels
    .filter((h) => h.placeId === state.selectedPlaceId)
    .filter(hasCoordinates);

  if (!countryPlacesOnMap.length && !selectedPlaceActivities.length && !selectedPlaceHotels.length && !state.pendingPinTarget) {
    el.mapHint.textContent = state.locationStatusMessage || "Geen pins. Gebruik adres/link of “Pin op kaart”.";
    map.setView([20, 0], 2);
    setTimeout(() => map.invalidateSize(), 0);
    return;
  }

  const pendingLabel = resolvePendingLabel();
  if (pendingLabel) {
    el.mapHint.textContent = `Pinmodus actief: tik op de kaart voor "${pendingLabel}".`;
    el.placeMap.style.cursor = "crosshair";
  } else {
    const totalPins = countryPlacesOnMap.length + selectedPlaceActivities.length + selectedPlaceHotels.length;
    el.mapHint.textContent = state.locationStatusMessage || `Pins op kaart: ${totalPins}`;
    el.placeMap.style.cursor = "";
  }

  const bounds = [];

  countryPlacesOnMap.forEach((place) => {
    const marker = L.marker([place.latitude, place.longitude])
      .addTo(map)
      .bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${place.type === "city" ? "Stad" : "Gebied"}`);
    mapMarkers.push(marker);
    bounds.push([place.latitude, place.longitude]);
  });

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

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [20, 20] });
  } else {
    map.setView([20, 0], 2);
  }
  setTimeout(() => map.invalidateSize(), 0);
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
  websiteBeforeMaps = false
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

  return {
    name: trimmedName,
    address: addressValue.trim(),
    mapsLink: mapsLinkValue,
    websiteUrl,
    photoUrl
  };
}

function buildActivityPreviewImage(activity) {
  if (activity.photoUrl && (/^https?:\/\//i.test(activity.photoUrl) || /^data:image\//i.test(activity.photoUrl))) {
    return activity.photoUrl;
  }
  return "";
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
      data.countries.push({ id: cid, name: "Hersteld (oude plekken)" });
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
  base.countries = Array.isArray(parsed.countries) ? parsed.countries : [];
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
    latitude: null,
    longitude: null,
    ...hotel,
    sortOrder: typeof hotel.sortOrder === "number" && Number.isFinite(hotel.sortOrder) ? hotel.sortOrder : undefined,
    address: typeof hotel.address === "string" ? hotel.address : "",
    mapsLink: typeof hotel.mapsLink === "string" ? hotel.mapsLink : "",
    websiteUrl: typeof hotel.websiteUrl === "string" ? hotel.websiteUrl : "",
    latitude: typeof hotel.latitude === "number" ? hotel.latitude : null,
    longitude: typeof hotel.longitude === "number" ? hotel.longitude : null
  })) : [];
  migrateMissingSortOrders(base);
  let repaired = false;
  if (recoverMissingCountries(base)) repaired = true;
  if (reattachOrphanItemsByOldPlaceNames(base, rawPlaces)) repaired = true;
  return { data: base, repaired };
}

function emptyData() {
  return {
    countries: [],
    places: [],
    activities: [],
    hotels: []
  };
}

function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  renderAll();
}

function seedData() {
  const thailand = { id: uid(), name: "Thailand" };
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
    photoUrl: "",
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
    latitude: null,
    longitude: null,
    sortOrder: 0
  });

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

