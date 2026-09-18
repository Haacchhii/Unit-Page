import catalog from "./catalog.json";
import "@fontsource-variable/newsreader/wght.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "@fontsource-variable/source-sans-3/wght.css";
import {
  escapeHtml as esc,
  directoryCoverPhoto,
  findUnitsByExactLabel,
  groupUnits,
  parseUnit,
  ordinal,
  photoPath,
  sleepingAreaPhoto,
  unitAlbumName,
  unitDetailLabel,
  unitDisplayName,
  unitHasRentalType,
  unitRentalTypes,
  validateCatalog,
} from "./catalog.js";
import { galleryMarkup, mountGallery } from "./gallery.js";
import {
  inclusionsSection,
  nearbyLocationsSection,
  sharedSpacesSection,
} from "./inclusions.js";
import "./styles.css";

validateCatalog(catalog);
const app = document.querySelector("#app");
let cleanup = () => {};
const directoryPositions = new Map();
let previousRoute;
const comparisonStorageKey = "jpp-unit-comparison";
const buildingName = catalog.building || "Victoria De Makati";
const brand = `<a class="brand" href="#/" aria-label="${esc(catalog.name)} home"><img src="brand/jpp-rental-homestay-logo.webp" alt="" width="180" height="180"><span>${esc(catalog.name)}</span></a>`;
const isPlaceholderAlbum = (unit) =>
  unit.photos.every((photo) => photo.placeholder);
const siteLocation = catalog.location || {
  name: buildingName,
  address: "Washington St, Brgy. Pio del Pilar, Makati",
  mapsUrl:
    "https://www.google.com/maps?output=search&q=victoria+de+makati+condominium,+washington+st,+brgy.+pio+del+pilar,+makati",
  embedUrl:
    "https://www.google.com/maps?q=victoria+de+makati+condominium,+washington+st,+brgy.+pio+del+pilar,+makati&output=embed",
};

function header(active) {
  return `<header class="site-header">${brand}<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-navigation"><span>Menu</span><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg></button><nav id="main-navigation" aria-label="Main navigation"><a href="#/" ${active === "home" ? 'aria-current="page"' : ""}>Home</a><a href="#/about" ${active === "about" ? 'aria-current="page"' : ""}>About</a><a href="#/units?tower=A" ${active === "units" ? 'aria-current="page"' : ""}>Our units</a>${active === "home" ? "" : '<a class="button header-cta" href="#/units?tower=A">Explore the units <span aria-hidden="true">↗</span></a>'}</nav></header>`;
}
function footer() {
  const phone = catalog.contact?.phone?.trim();
  const facebookUrl = catalog.contact?.facebookUrl?.trim();
  return `<footer class="site-footer"><div class="footer-brand"><span>${esc(catalog.name)}</span><p>${esc(buildingName)} · ${catalog.preview ? "Placeholder albums are labeled" : "A closer look at your next home."}</p></div>${phone && facebookUrl ? `<div class="footer-contact"><div><span>Questions about a unit?</span><strong>Contact JPP Rental Homestay</strong></div><a class="footer-phone" href="tel:${esc(phone.replace(/[^+\d]/g, ""))}"><small>Call or text</small><b>${esc(phone)}</b></a><a class="footer-facebook" href="${esc(facebookUrl)}" target="_blank" rel="noopener noreferrer">Ask on Facebook <span aria-hidden="true">↗</span></a></div>` : ""}<a class="footer-units" href="#/units?tower=A">Explore the units <span aria-hidden="true">↗</span></a></footer>`;
}

function comparisonUnits() {
  try {
    const ids = JSON.parse(localStorage.getItem(comparisonStorageKey) || "[]");
    return Array.isArray(ids)
      ? ids
          .map((id) => catalog.units.find((unit) => unit.id === id))
          .filter(Boolean)
          .slice(0, 3)
      : [];
  } catch {
    return [];
  }
}

function comparisonButton(unit, compact = false) {
  const units = comparisonUnits();
  const selected = units.some((item) => item.id === unit.id);
  const full = units.length >= 3 && !selected;
  return `<button class="compare-toggle${compact ? " compare-toggle-compact" : ""}" type="button" data-compare-unit="${esc(unit.id)}" aria-pressed="${selected}" ${full ? "disabled" : ""}>${selected ? "Remove from comparison" : full ? "Comparison is full" : "Add to comparison"}</button>`;
}

function comparisonTray() {
  const units = comparisonUnits();
  if (!units.length) return `<aside class="comparison-tray" aria-label="Unit comparison" hidden></aside>`;
  return `<aside class="comparison-tray" aria-label="Unit comparison"><div><span>Compare units</span><strong>${units.map((unit) => esc(unitDisplayName(unit))).join(" · ")}</strong><small>${units.length} of 3 selected</small></div><div class="comparison-tray-actions"><button type="button" data-clear-comparison>Clear</button><a href="#/compare" ${units.length < 2 ? 'aria-disabled="true" tabindex="-1"' : ""}>Compare ${units.length} units <span aria-hidden="true">↗</span></a></div><p class="visually-hidden" aria-live="polite">${units.length} ${units.length === 1 ? "unit" : "units"} selected for comparison.</p></aside>`;
}
function locationSection() {
  return `<section class="location-section" id="about-location" aria-labelledby="location-heading"><div class="location-copy"><p class="eyebrow"><span class="fine-line"></span>Location</p><h2 id="location-heading">Find us at<br><em>${esc(siteLocation.name)}</em></h2><p>${esc(siteLocation.address)}</p><a class="button" href="${esc(siteLocation.mapsUrl)}" target="_blank" rel="noopener noreferrer">Open in Google Maps <span aria-hidden="true">↗</span></a></div><div class="map-card"><iframe title="${esc(siteLocation.name)} map" src="${esc(siteLocation.embedUrl)}" width="900" height="520" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe><a class="map-overlay" href="${esc(siteLocation.mapsUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(siteLocation.name)} on Google Maps"><span>${esc(siteLocation.name)}</span><small>${esc(siteLocation.address)}</small><b aria-hidden="true">↗</b></a></div></section>`;
}
function home() {
  const featuredUnit = (type) => {
    const configuredId = catalog.homeFeatures?.[type.toLowerCase()];
    return catalog.units.find((unit) => unit.id === configuredId);
  };
  const featuredPhoto = (unit, type) => {
    const configuredIndex = catalog.homeFeatures?.[`${type.toLowerCase()}Photo`];
    if (Number.isInteger(configuredIndex) && unit?.photos[configuredIndex])
      return unit.photos[configuredIndex];
    const group = unit?.photoGroups?.find((item) => item.label === type);
    return unit?.photos[group?.start ?? 0];
  };
  const featureCard = (type) => {
    const unit = featuredUnit(type);
    if (!unit) return "";
    const photo = featuredPhoto(unit, type);
    const details = parseUnit(unit.unitNumber || unit.id);
    return `<article class="home-feature"><a class="home-feature-image" href="#/units/${esc(unit.id)}"><img src="${photoPath(unit, photo)}" alt="${esc(photo.alt)}" width="1800" height="1200" loading="lazy"><span>View featured unit <b aria-hidden="true">↗</b></span></a><div class="home-feature-copy"><p class="eyebrow">${esc(type)} collection</p><h3>${esc(unitDisplayName(unit))}</h3><p>See this real unit album, or browse every ${type.toLowerCase()} currently in the collection.</p><a class="text-link" href="#/units?tower=${details.tower}&type=${encodeURIComponent(type)}">Browse all ${type.toLowerCase()}s <span aria-hidden="true">↗</span></a></div></article>`;
  };
  return `${header("home")}<main id="main" tabindex="-1"><section class="hero" aria-labelledby="home-heading">
    <img class="hero-photo" src="${esc(catalog.hero.src)}" alt="${esc(catalog.hero.alt)}" width="${catalog.hero.width || 1800}" height="${catalog.hero.height || 1200}" fetchpriority="high">
    <div class="hero-shade"></div><div class="hero-content"><p class="eyebrow">${esc(buildingName)}</p><h1 id="home-heading">A closer look at<br>your next <em>home.</em></h1><p class="hero-intro">Explore JPP Rental Homestay units before your personal viewing.</p><a class="button button-light" href="#/units?tower=A">Browse unit photos <span aria-hidden="true">↗</span></a></div>
    <span class="hero-note">${catalog.preview ? `${esc(buildingName)} · Photo gallery preview` : `Discover ${esc(buildingName)}`}</span>
  </section><section class="home-collections" aria-labelledby="collections-heading"><div class="home-collections-heading"><p class="eyebrow"><span class="fine-line"></span>Choose how you want to live</p><h2 id="collections-heading">Start with the space<br>that <em>fits.</em></h2><p>Browse actual unit photos by rental type before arranging a personal viewing.</p></div><div class="home-feature-grid">${featureCard("Bedroom")}${featureCard("Bedspace")}</div></section><section class="tower-intro" aria-labelledby="towers-heading"><p class="eyebrow"><span class="fine-line"></span>${esc(buildingName)}</p><h2 id="towers-heading">Two towers.<br><em>Your point of view.</em></h2><div class="tower-links" aria-label="Direct tower shortcuts"><a href="#/units?tower=A"><span>Tower A</span><span aria-hidden="true">↗</span></a><a href="#/units?tower=B"><span>Tower B</span><span aria-hidden="true">↗</span></a><a href="#/about"><span>Complete building guide</span><span aria-hidden="true">↗</span></a></div></section></main>${footer()}`;
}

function about() {
  return `${header("about")}<main class="about page-shell" id="main" tabindex="-1"><div class="breadcrumb"><a href="#/">Home</a><span>/</span><span>About</span></div><section class="about-intro" aria-labelledby="about-heading"><div class="about-copy"><p class="eyebrow">The complete building guide</p><h1 id="about-heading">About <em>${esc(buildingName)}.</em></h1><p>Everything essential in one place: shared spaces, what is included, the exact location, and useful places nearby.</p><a class="text-link" href="#/units?tower=A">Browse the unit collection <span aria-hidden="true">↗</span></a></div><figure class="about-portrait"><img src="${esc(catalog.hero.src)}" alt="${esc(catalog.hero.alt)}" width="${catalog.hero.width || 1800}" height="${catalog.hero.height || 1200}"><figcaption>${esc(siteLocation.name)} · Makati</figcaption></figure></section><nav class="about-index" aria-label="About page sections"><span>Explore the guide</span><button type="button" data-section="about-shared">Building & shared spaces</button><button type="button" data-section="about-included">What is included</button><button type="button" data-section="about-location">Address & map</button><button type="button" data-section="about-nearby">Nearby essentials</button></nav>${sharedSpacesSection()}${inclusionsSection()}${locationSection()}${nearbyLocationsSection()}<section class="about-next" aria-labelledby="about-next-heading"><h2 id="about-next-heading">Ready to look <em>inside?</em></h2><p>Browse every unit photo by tower, floor, and unit.</p><div><a class="button" href="#/units?tower=A">Explore Tower A <span aria-hidden="true">↗</span></a><a class="text-link" href="#/units?tower=B">Explore Tower B <span aria-hidden="true">↗</span></a></div></section></main>${footer()}`;
}

function unitSearch() {
  const options = catalog.units
    .map((unit) => `<option value="${esc(unit.id)}">${esc(unitAlbumName(unit))}</option>`)
    .join("");
  return `<form class="unit-search" novalidate><label for="unit-search-input">Open a unit directly</label><div><input id="unit-search-input" name="unit" list="unit-search-options" autocomplete="off" spellcheck="false" placeholder="Type a unit, e.g. 1023B"><button type="submit">Open unit</button></div><datalist id="unit-search-options">${options}</datalist><p class="unit-search-status" aria-live="polite">Enter an exact unit number or choose a suggestion.</p></form>`;
}

function directory(tower, rentalType) {
  const towerUnits = groupUnits(catalog.units, tower).flatMap(
    (group) => group.units,
  );
  const groups = groupUnits(
    catalog.units.filter((unit) => unitHasRentalType(unit, rentalType)),
    tower,
  );
  const filterLink = (label, value) => {
    const selected = rentalType === value;
    const query = new URLSearchParams({ tower });
    if (value) query.set("type", value);
    const count = value
      ? towerUnits.filter((unit) => unitHasRentalType(unit, value)).length
      : towerUnits.length;
    return `<a href="#/units?${query}" ${selected ? 'aria-current="page"' : ""}><span>${label}</span><small>${count}</small></a>`;
  };
  const directoryQuery = rentalType
    ? `&type=${encodeURIComponent(rentalType)}`
    : "";
  return `${header("units")}<main class="directory page-shell" id="main" tabindex="-1"><div class="breadcrumb"><a href="#/">Home</a><span>/</span><span>Our units</span></div><div class="directory-heading"><div><p class="eyebrow">${esc(buildingName)}</p><h1>Find your <em>space.</em></h1><p class="intro">Choose a tower. Take a look inside.</p></div><p class="collection-note">${catalog.preview ? "Explore unit photos and placeholders.<br> Placeholder albums are labeled." : "Explore the photographs<br> before your personal viewing."}</p></div>
    <nav class="tower-tabs" aria-label="Choose a tower">${["A", "B"].map((t) => `<a href="#/units?tower=${t}${rentalType ? `&type=${encodeURIComponent(rentalType)}` : ""}" ${t === tower ? 'aria-current="page"' : ""}>Tower ${t}<span aria-hidden="true">↗</span></a>`).join("")}</nav><nav class="rental-filters" aria-label="Filter units by rental type">${filterLink("All units", null)}${filterLink("Bedrooms", "Bedroom")}${filterLink("Bedspaces", "Bedspace")}</nav>${unitSearch()}
    ${groups.length ? `<nav class="floor-index" aria-label="Jump to a floor"><span>Floor index</span><div>${groups.map((group) => `<a href="#/units?tower=${tower}&floor=${group.floor}${directoryQuery}">${String(group.floor).padStart(2, "0")}</a>`).join("")}</div></nav>` : ""}
  <div class="floor-list">${groups.length ? groups.map((group) => `<section class="floor-row" id="floor-${group.floor}" aria-labelledby="floor-heading-${group.floor}"><div class="floor-label"><p class="eyebrow">Tower ${tower}</p><h2 id="floor-heading-${group.floor}">${ordinal(group.floor)} floor</h2><p>${group.units.length} ${group.units.length === 1 ? "album" : "albums"}</p></div><div class="unit-grid">${group.units.map((unit) => {
    const cover = directoryCoverPhoto(unit);
    const identity = parseUnit(unit.unitNumber || unit.id);
    const types = unitRentalTypes(unit);
    return `<article class="unit-card"><a class="unit-album" href="#/units/${unit.id}${rentalType ? `?type=${encodeURIComponent(rentalType)}` : ""}" aria-label="View ${esc(unitAlbumName(unit))} photo album"><div class="unit-cover"><img src="${photoPath(unit, cover, "thumb")}" alt="${esc(cover.alt)}" width="640" height="427" loading="lazy"><span class="unit-index-mark" aria-hidden="true">T${identity.tower} / F${String(identity.floor).padStart(2, "0")}</span>${unit.sample ? `<span class="sample-tag">${isPlaceholderAlbum(unit) ? "Placeholder photos" : "Sample interiors"}</span>` : ""}<span class="cover-arrow" aria-hidden="true">↗</span></div><div class="unit-title"><div><h3>${esc(unitDisplayName(unit))}</h3>${types.length ? `<p>${types.map((type) => `<span>${esc(type)}</span>`).join("")}</p>` : ""}</div><span>${unit.photos.length} photos <span aria-hidden="true">↗</span></span></div></a>${comparisonButton(unit, true)}</article>`;
  }).join("")}</div></section>`).join("") : `<div class="empty-state"><h2>No ${rentalType ? rentalType.toLowerCase() : "unit"} albums in Tower ${tower}.</h2><p>Choose another filter or explore the other tower.</p></div>`}</div>
    <p class="directory-footnote">Photos are for viewing reference. Please confirm current availability with the office.</p></main>${footer()}`;
}

function albumSequence(unit, details) {
  const units = groupUnits(catalog.units, details.tower).flatMap(
    (group) => group.units,
  );
  const index = units.findIndex((candidate) => candidate.id === unit.id);
  const previous = index > 0 ? units[index - 1] : null;
  const next = index < units.length - 1 ? units[index + 1] : null;
  const link = (candidate, direction) =>
    candidate
      ? `<a href="#/units/${candidate.id}"><small>${direction} unit</small><strong>${esc(unitDisplayName(candidate))}</strong><span aria-hidden="true">${direction === "Previous" ? "←" : "→"}</span></a>`
      : `<span class="album-sequence-end"><small>${direction} unit</small><strong>End of Tower ${details.tower}</strong></span>`;
  return `<nav class="album-sequence" aria-label="Browse neighboring units">${link(previous, "Previous")}${link(next, "Next")}</nav>`;
}

function inquirySection(unit) {
  const phone = catalog.contact?.phone?.trim();
  const facebookUrl = catalog.contact?.facebookUrl?.trim();
  if (!phone || !facebookUrl) return "";
  return `<section class="unit-inquiry" aria-labelledby="unit-inquiry-heading"><div><p class="eyebrow">Interested in this unit?</p><h2 id="unit-inquiry-heading">Ask about <em>Unit ${esc(unitDisplayName(unit))}.</em></h2><p>Call <a href="tel:${esc(phone.replace(/[^+\d]/g, ""))}">${esc(phone)}</a>, or send JPP Rental Homestay a message on Facebook. Mention this unit number so we can help you with the right album.</p></div><a class="button" href="${esc(facebookUrl)}" target="_blank" rel="noopener noreferrer">Ask about this unit <span aria-hidden="true">↗</span></a></section>`;
}

function album(unit, rentalType) {
  const details = parseUnit(unit.unitNumber || unit.id);
  const albumName = unitAlbumName(unit);
  const detail = unitDetailLabel(unit);
  const filterQuery = rentalType
    ? `&type=${encodeURIComponent(rentalType)}`
    : "";
  const shareUrl = unitShareUrl(unit);
  return `${header("units")}<main class="album page-shell" id="main" tabindex="-1"><div class="breadcrumb"><a href="#/units?tower=${details.tower}${filterQuery}">Our units</a><span>/</span><span>${esc(buildingName)}</span><span>/</span><a href="#/units?tower=${details.tower}&floor=${details.floor}${filterQuery}">Tower ${details.tower}</a><span>/</span><span>${ordinal(details.floor)} floor</span>${detail ? `<span>/</span><span>${esc(detail)}</span>` : ""}</div><div class="album-heading"><div class="album-identity"><span class="album-index-mark" aria-hidden="true"><b>${details.tower}</b><small>Tower</small><b>${String(details.floor).padStart(2, "0")}</b><small>Floor</small></span><div><h1>Unit <em>${esc(unitDisplayName(unit))}</em></h1><p class="intro">${esc(buildingName)}${detail ? ` <span aria-hidden="true">·</span> ${esc(detail)}` : ""}</p></div></div><div class="album-heading-actions"><button class="share-unit" type="button" data-unit-id="${esc(unit.id)}">Share this unit</button>${comparisonButton(unit)}<a class="back-link" href="#/units?tower=${details.tower}&floor=${details.floor}${filterQuery}">← Back to ${ordinal(details.floor)} floor</a></div></div>${unit.sample ? `<p class="sample-notice">${isPlaceholderAlbum(unit) ? `Placeholder photos · Replace these images when ${esc(albumName)} photos are available.` : "Sample interiors · These images illustrate the gallery and are not photos of this unit."}</p>` : ""}${galleryMarkup(unit, shareUrl)}${inquirySection(unit)}${albumSequence(unit, details)}<section class="album-about-bridge" aria-labelledby="album-about-heading"><div><h2 id="album-about-heading">About the building</h2><p>See what is included, find ${esc(siteLocation.name)}, and explore nearby locations.</p></div><a class="text-link" href="#/about">Explore the building guide <span aria-hidden="true">↗</span></a></section></main>${footer()}`;
}

function comparisonPage() {
  const units = comparisonUnits();
  const cards = units
    .map((unit) => {
      const details = parseUnit(unit.unitNumber || unit.id);
      const cover = sleepingAreaPhoto(unit);
      const types = unitRentalTypes(unit);
      return `<article class="comparison-unit"><a class="comparison-photo" href="#/units/${esc(unit.id)}"><img src="${photoPath(unit, cover)}" alt="${esc(cover.alt)}" width="1800" height="1200"><span>Open album <b aria-hidden="true">↗</b></span></a><div class="comparison-unit-heading"><h2>${esc(unitDisplayName(unit))}</h2>${comparisonButton(unit, true)}</div><dl><div><dt>Tower</dt><dd>${details.tower}</dd></div><div><dt>Floor</dt><dd>${ordinal(details.floor)}</dd></div><div><dt>Rental type</dt><dd>${types.length ? types.map(esc).join(" & ") : "Not yet labelled"}</dd></div><div><dt>Album</dt><dd>${unit.photos.length} ${unit.photos.length === 1 ? "photo" : "photos"}</dd></div></dl>${unit.sample ? `<p class="comparison-note">${isPlaceholderAlbum(unit) ? "Placeholder photos" : "Sample interiors"}</p>` : ""}</article>`;
    })
    .join("");
  return `${header("units")}<main class="comparison-page page-shell" id="main" tabindex="-1"><div class="breadcrumb"><a href="#/units?tower=A">Our units</a><span>/</span><span>Compare</span></div><div class="comparison-heading"><h1>Compare your <em>shortlist.</em></h1><p>Review confirmed catalog details side by side, then open each album for the full set of photos.</p></div>${units.length >= 2 ? `<section class="comparison-grid" aria-label="Selected units">${cards}</section>` : `<section class="comparison-empty"><h2>Select at least two units.</h2><p>Add units from either tower to compare their confirmed details here.</p><a class="button" href="#/units?tower=A">Browse the units <span aria-hidden="true">↗</span></a></section>`}</main>${footer()}`;
}

function normalizeRentalType(value) {
  return ["Bedroom", "Bedspace"].includes(value) ? value : null;
}

function getRoute() {
  const [path, query = ""] = location.hash.slice(1).split("?");
  if (!path || path === "/") return { type: "home" };
  if (path === "/about") return { type: "about" };
  if (path === "/compare") return { type: "compare" };
  if (path === "/units")
    return {
      type: "directory",
      tower: new URLSearchParams(query).get("tower") === "B" ? "B" : "A",
      floor: Number(new URLSearchParams(query).get("floor")) || null,
      rentalType: normalizeRentalType(new URLSearchParams(query).get("type")),
    };
  const match = /^\/units\/([A-Za-z0-9-]+)$/.exec(path);
  const unit = match && catalog.units.find((unit) => unit.id === match[1]);
  return unit
    ? {
        type: "album",
        unit,
        rentalType: normalizeRentalType(new URLSearchParams(query).get("type")),
      }
    : { type: "missing" };
}

function mountDirectorySearch() {
  const form = document.querySelector(".unit-search");
  if (!form) return () => {};
  const input = form.querySelector("input");
  const status = form.querySelector(".unit-search-status");
  const submit = (event) => {
    event.preventDefault();
    const matches = findUnitsByExactLabel(catalog.units, input.value);
    if (matches.length === 1) {
      location.hash = `/units/${matches[0].id}`;
      return;
    }
    status.textContent = matches.length
      ? "More than one album uses that unit number. Choose a specific suggestion."
      : "That unit is not in the current collection. Check the number and try again.";
    input.setAttribute("aria-invalid", "true");
    input.focus();
  };
  const clearError = () => {
    input.removeAttribute("aria-invalid");
    status.textContent = "Enter an exact unit number or choose a suggestion.";
  };
  form.addEventListener("submit", submit);
  input.addEventListener("input", clearError);
  return () => {
    form.removeEventListener("submit", submit);
    input.removeEventListener("input", clearError);
  };
}

function mountAboutIndex() {
  const buttons = [...document.querySelectorAll(".about-index [data-section]")];
  if (!buttons.length) return () => {};
  const sections = buttons.map((button) =>
    document.querySelector(`#${button.dataset.section}`),
  );
  const clickHandlers = buttons.map((button, index) => () =>
    sections[index]?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    }),
  );
  buttons.forEach((button, index) =>
    button.addEventListener("click", clickHandlers[index]),
  );
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      buttons.forEach((button) =>
        button.toggleAttribute(
          "aria-current",
          button.dataset.section === visible.target.id,
        ),
      );
    },
    { rootMargin: "-20% 0px -65%", threshold: [0, 0.25, 0.6] },
  );
  sections.filter(Boolean).forEach((section) => observer.observe(section));
  return () => {
    observer.disconnect();
    buttons.forEach((button, index) =>
      button.removeEventListener("click", clickHandlers[index]),
    );
  };
}

function mountHeader() {
  const toggle = document.querySelector(".nav-toggle");
  const navigation = document.querySelector("#main-navigation");
  if (!toggle || !navigation) return () => {};
  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-open");
  };
  const click = () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    document.body.classList.toggle("nav-open", !expanded);
  };
  toggle.addEventListener("click", click);
  navigation.addEventListener("click", close);
  return () => {
    toggle.removeEventListener("click", click);
    navigation.removeEventListener("click", close);
    document.body.classList.remove("nav-open");
  };
}

function unitShareUrl(unit) {
  const basePath = location.pathname.endsWith("/")
    ? location.pathname
    : `${location.pathname.slice(0, location.pathname.lastIndexOf("/") + 1)}`;
  return new URL(`units/${unit.id}/`, `${location.origin}${basePath}`).href;
}

function mountShareUnit(unit) {
  const button = document.querySelector(".share-unit");
  if (!button) return () => {};
  const share = async () => {
    const shareData = {
      title: `Unit ${unitAlbumName(unit)} | ${catalog.name}`,
      text: `View the photographs for Unit ${unitAlbumName(unit)} at ${buildingName}.`,
      url: unitShareUrl(unit),
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        button.textContent = "Link copied";
      }
    } catch (error) {
      if (error?.name !== "AbortError") button.textContent = "Copy failed";
    }
  };
  button.addEventListener("click", share);
  return () => button.removeEventListener("click", share);
}

function mountComparison() {
  const handleClick = (event) => {
    const toggle = event.target.closest("[data-compare-unit]");
    const clear = event.target.closest("[data-clear-comparison]");
    if (!toggle && !clear) return;
    let ids = comparisonUnits().map((unit) => unit.id);
    if (clear) ids = [];
    if (toggle) {
      const id = toggle.dataset.compareUnit;
      ids = ids.includes(id)
        ? ids.filter((item) => item !== id)
        : ids.length < 3
          ? [...ids, id]
          : ids;
    }
    localStorage.setItem(comparisonStorageKey, JSON.stringify(ids));
    if (getRoute().type === "compare") {
      render();
      return;
    }
    document.querySelectorAll("[data-compare-unit]").forEach((button) => {
      const selected = ids.includes(button.dataset.compareUnit);
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = selected
        ? "Remove from comparison"
        : ids.length >= 3
          ? "Comparison is full"
          : "Add to comparison";
      button.disabled = !selected && ids.length >= 3;
    });
    document.querySelector(".comparison-tray")?.remove();
    document.body.insertAdjacentHTML("beforeend", comparisonTray());
  };
  document.addEventListener("click", handleClick);
  return () => document.removeEventListener("click", handleClick);
}

function setPageMetadata(route) {
  const title =
    route.type === "album"
      ? `Unit ${unitAlbumName(route.unit)} | ${catalog.name}`
      : route.type === "directory"
        ? `Tower ${route.tower} · ${buildingName} | ${catalog.name}`
        : route.type === "compare"
          ? `Compare units | ${catalog.name}`
        : route.type === "about"
          ? `About ${buildingName} | ${catalog.name}`
          : route.type === "missing"
            ? `Album not found | ${catalog.name}`
            : `${catalog.name} · ${buildingName}`;
  const description =
    route.type === "album"
      ? `View photos for Unit ${unitAlbumName(route.unit)} at ${buildingName}.`
      : `Explore ${catalog.name} unit photo albums at ${buildingName} by tower, floor and unit.`;
  const image =
    route.type === "album"
      ? new URL(
          photoPath(route.unit, directoryCoverPhoto(route.unit)),
          location.href.split("#")[0],
        ).href
      : new URL(catalog.hero.src, location.href.split("#")[0]).href;
  const canonical =
    route.type === "album" ? unitShareUrl(route.unit) : location.href.split("#")[0];
  document.title = title;
  document.querySelector('meta[name="description"]').content = description;
  document.querySelector('meta[property="og:title"]').content = title;
  document.querySelector('meta[property="og:description"]').content = description;
  document.querySelector('meta[property="og:image"]').content = image;
  document.querySelector('meta[property="og:url"]').content = canonical;
  document.querySelector('link[rel="canonical"]').href = canonical;
}

function combineCleanups(...cleanups) {
  return () => cleanups.forEach((dispose) => dispose());
}

function render({ initial = false } = {}) {
  if (previousRoute?.type === "directory")
    directoryPositions.set(previousRoute.tower, window.scrollY);
  cleanup();
  document.querySelector(".comparison-tray")?.remove();
  const route = getRoute();
  const returning =
    previousRoute?.type === "album" && route.type === "directory";
  const page =
    route.type === "home"
      ? home()
      : route.type === "about"
        ? about()
      : route.type === "directory"
        ? directory(route.tower, route.rentalType)
        : route.type === "album"
          ? album(route.unit, route.rentalType)
          : route.type === "compare"
            ? comparisonPage()
          : `${header("units")}<main id="main" class="page-shell empty-state" tabindex="-1"><p class="eyebrow">Our collection</p><h1>That album isn’t here.</h1><p>The unit may not have photos yet, or the link may be incorrect.</p><a class="button" href="#/units?tower=A">Back to the units ↗</a></main>${footer()}`;
  app.innerHTML = page;
  if (route.type !== "compare")
    document.body.insertAdjacentHTML("beforeend", comparisonTray());
  setPageMetadata(route);
  const routeCleanup =
    route.type === "album"
      ? mountGallery(route.unit, unitShareUrl(route.unit))
      : route.type === "directory"
        ? mountDirectorySearch()
        : route.type === "about"
          ? mountAboutIndex()
          : () => {};
  cleanup = combineCleanups(
    mountHeader(),
    mountComparison(),
    routeCleanup,
    route.type === "album" ? mountShareUnit(route.unit) : () => {},
  );
  document
    .querySelectorAll(".unit-cover img, .hero-photo")
    .forEach((img) =>
      img.addEventListener("error", () =>
        img.classList.add("image-unavailable"),
      ),
    );
  requestAnimationFrame(() => {
    if (!initial)
      document.querySelector("#main").focus({ preventScroll: true });
    window.scrollTo({
      top:
        route.type === "directory" && route.floor
          ? Math.max(
              0,
              (document.querySelector(`#floor-${route.floor}`)?.offsetTop || 0) -
                24,
            )
          : returning
            ? directoryPositions.get(route.tower) || 0
            : 0,
      behavior: "instant",
    });
  });
  previousRoute = route;
}
window.addEventListener("hashchange", () => {
  if (location.hash !== "#main") render();
});
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  document.querySelector("#main").focus();
});
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
render({ initial: true });
