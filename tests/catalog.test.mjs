import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseUnit,
  ordinal,
  groupUnits,
  validateCatalog,
  photoPath,
  directoryCoverPhoto,
  sleepingAreaPhoto,
  unitAlbumName,
  unitDetailLabel,
  unitDisplayName,
  unitHasRentalType,
  unitRentalTypes,
  wrapIndex,
  escapeHtml,
  findUnitsByExactLabel,
} from "../src/catalog.js";
import { galleryMarkup } from "../src/gallery.js";
import {
  inclusionsSection,
  nearbyLocationsSection,
  sharedSpacesSection,
} from "../src/inclusions.js";

const catalog = JSON.parse(
  readFileSync(new URL("../src/catalog.json", import.meta.url), "utf8"),
);

test("real identifiers preserve the unit component and derive tower and floor", () => {
  assert.deepEqual(parseUnit("2103B"), {
    id: "2103B",
    floor: 21,
    number: "03",
    tower: "B",
  });
  assert.deepEqual(parseUnit("1224-25B"), {
    id: "1224-25B",
    floor: 12,
    number: "24-25",
    tower: "B",
  });
  assert.deepEqual(parseUnit("1619A-1620A"), {
    id: "1619A-1620A",
    floor: 16,
    number: "19-20",
    tower: "A",
  });
  assert.equal(parseUnit("1504A").floor, 15);
  for (const id of ["2103C", "../2103B", "0000A", "2100B", "1619A-1720A"])
    assert.throws(() => parseUnit(id));
});
test("floor labels handle teen suffixes", () => {
  assert.deepEqual([1, 2, 3, 11, 12, 13, 21, 22].map(ordinal), [
    "1st",
    "2nd",
    "3rd",
    "11th",
    "12th",
    "13th",
    "21st",
    "22nd",
  ]);
});
test("groups only requested tower, numerically sorted by floor then unit", () => {
  const units = ["1504A", "2103B", "1504B", "2101B"].map((id) => ({ id }));
  assert.deepEqual(
    groupUnits(units, "B").map((g) => g.units.map((u) => u.id)),
    [["2101B", "2103B"], ["1504B"]],
  );
  assert.deepEqual(groupUnits([], "A"), []);
});
test("route-safe albums can share one real unit number", () => {
  const splitUnit = {
    id: "1633A-1st-floor",
    unitNumber: "1633A",
    displayName: "1633A",
    spaceLabel: "1st Floor",
    photos: [{ file: "living-room", alt: "Living room", caption: "Living area" }],
  };
  assert.doesNotThrow(() =>
    validateCatalog({ name: "Example", units: [splitUnit] }),
  );
  const [sixteenthFloor] = groupUnits([splitUnit], "A");
  assert.equal(sixteenthFloor.floor, 16);
  assert.equal(sixteenthFloor.units[0].id, "1633A-1st-floor");
  assert.equal(sixteenthFloor.units[0].unitNumber, "1633A");
  assert.equal(unitDisplayName(splitUnit), "1633A");
  assert.equal(unitAlbumName(splitUnit), "1633A · 1st Floor");
});
test("rental type labels remain distinct from existing unit details", () => {
  const bedspace = {
    id: "1912B",
    rentalType: "Bedspace",
    spaceLabel: "All Girls",
  };
  assert.equal(unitDetailLabel(bedspace), "Bedspace · All Girls");
  assert.equal(unitAlbumName(bedspace), "1912B · Bedspace · All Girls");
  const combined = {
    id: "1023B",
    rentalTypes: ["Bedroom", "Bedspace"],
    photos: unit.photos,
  };
  assert.equal(unitDetailLabel(combined), "Bedroom & Bedspace");
  assert.equal(unitAlbumName(combined), "1023B · Bedroom & Bedspace");
  assert.deepEqual(unitRentalTypes(combined), ["Bedroom", "Bedspace"]);
  assert.equal(unitHasRentalType(combined, "Bedroom"), true);
  assert.equal(unitHasRentalType(combined, "Bedspace"), true);
  assert.equal(unitHasRentalType(bedspace, "Bedroom"), false);
  assert.equal(unitHasRentalType(bedspace, null), true);
  assert.doesNotThrow(() =>
    validateCatalog({ name: "Example", units: [combined] }),
  );
  assert.throws(() =>
    validateCatalog({
      name: "Example",
      units: [{ ...unit, rentalType: "Shared room" }],
    }),
  );
});
test("combined albums separate common areas from bedroom and bedspace photos", () => {
  const groupedUnit = {
    id: "1023B",
    rentalTypes: ["Bedroom", "Bedspace"],
    photos: [
      { file: "kitchen", folder: "common-area", alt: "Kitchen", caption: "Shared kitchen" },
      { file: "bedroom-1", alt: "Bedroom one", caption: "Bedroom photo 1" },
      { file: "bedspace-1", alt: "Bedspace one", caption: "Bedspace photo 1" },
    ],
  };
  groupedUnit.photoGroups = [
    { label: "Common area", start: 0, count: 1 },
    { label: "Bedroom", start: 1, count: 1 },
    { label: "Bedspace", start: 2, count: 1 },
  ];
  const markup = galleryMarkup(groupedUnit);
  assert.match(markup, /class="gallery unified-gallery"/);
  assert.match(markup, />Common area<\/h3>/);
  assert.match(markup, />Bedroom<\/h3>/);
  assert.match(markup, />Bedspace<\/h3>/);
  assert.match(markup, /class="photo-group-label">Common area/);
  assert.match(markup, /class="photo-counter">01 \/ 01/);
  assert.equal((markup.match(/class="thumbnail"/g) || []).length, 3);
  assert.match(markup, /units\/1023B\/common-area\/kitchen-thumb.webp/);
});
test("real-photo albums expose every confirmed sleeping-area type to directory filters", () => {
  for (const catalogUnit of catalog.units.filter((item) => !item.sample)) {
    const groupedTypes = (catalogUnit.photoGroups || [])
      .map((group) => group.label)
      .filter((label) => ["Bedroom", "Bedspace"].includes(label));
    const rentalTypes = unitRentalTypes(catalogUnit);
    for (const groupedType of groupedTypes)
      assert.ok(
        rentalTypes.includes(groupedType),
        `${catalogUnit.id} is missing its ${groupedType} directory label`,
      );
  }
});
const unit = {
  id: "2103B",
  photos: [{ file: "living-room", alt: "Living room", caption: "Living area" }],
};
test("catalog rejects duplicates, empty albums and unsafe paths before building", () => {
  assert.doesNotThrow(() =>
    validateCatalog({ name: "Example", units: [unit] }),
  );
  assert.doesNotThrow(() =>
    validateCatalog({
      name: "Example",
      location: {
        name: "Victoria De Makati Condominium",
        address: "Washington St, Brgy. Pio del Pilar, Makati",
        mapsUrl: "https://www.google.com/maps?output=search&q=victoria+de+makati",
        embedUrl: "https://www.google.com/maps?q=victoria+de+makati&output=embed",
      },
      units: [unit],
    }),
  );
  assert.throws(() =>
    validateCatalog({
      name: "Example",
      location: {
        name: "Victoria De Makati Condominium",
        address: "Washington St, Brgy. Pio del Pilar, Makati",
        mapsUrl: "javascript:alert(1)",
        embedUrl: "https://www.google.com/maps?q=victoria+de+makati&output=embed",
      },
      units: [unit],
    }),
  );
  assert.throws(() =>
    validateCatalog({ name: "Example", units: [unit, unit] }),
  );
  assert.doesNotThrow(() =>
    validateCatalog({
      name: "Example",
      contact: {
        phone: "0947 580 7622",
        facebookUrl: "https://www.facebook.com/profile.php?id=123",
      },
      units: [unit],
    }),
  );
  assert.throws(() =>
    validateCatalog({
      name: "Example",
      contact: {
        phone: "0947 580 7622",
        facebookUrl: "javascript:alert(1)",
      },
      units: [unit],
    }),
  );
  assert.throws(() =>
    validateCatalog({ name: "Example", units: [{ ...unit, photos: [] }] }),
  );
  assert.throws(() =>
    validateCatalog({
      name: "Example",
      units: [
        { ...unit, photos: [{ file: "../secret", alt: "a", caption: "b" }] },
      ],
    }),
  );
  assert.equal(
    photoPath(unit, unit.photos[0], "thumb"),
    "units/2103B/living-room-thumb.webp",
  );
  assert.equal(
    photoPath(unit, { file: "kitchen", folder: "common-area" }, "thumb"),
    "units/2103B/common-area/kitchen-thumb.webp",
  );
  assert.equal(
    photoPath(unit, { file: "building", placeholder: true }, "thumb"),
    "units/_placeholders/building-thumb.webp",
  );
});
test("gallery wraps both directions, including single-photo albums", () => {
  assert.equal(wrapIndex(-1, 3), 2);
  assert.equal(wrapIndex(3, 3), 0);
  assert.equal(wrapIndex(-1, 1), 0);
});
test("directory cards use the first unit photo at every album size", () => {
  const sixPhotoUnit = {
    id: "1210B",
    photos: [
      { file: "building", alt: "Building exterior", caption: "The building" },
      { file: "living", alt: "Living room", caption: "Living & dining" },
      { file: "stairs", alt: "Staircase", caption: "Staircase" },
      { file: "sleep", alt: "Bedroom", caption: "Sleeping area" },
      { file: "bath", alt: "Bathroom", caption: "Bathroom" },
      { file: "pool", alt: "Pool", caption: "Pool area" },
    ],
  };
  assert.equal(directoryCoverPhoto(sixPhotoUnit).file, "building");
  assert.equal(
    directoryCoverPhoto({ ...sixPhotoUnit, photos: sixPhotoUnit.photos.slice(0, 4) }).file,
    "building",
  );
});
test("comparison cards prioritize a confirmed bedroom or bedspace photo", () => {
  const groupedUnit = {
    id: "2116B",
    photos: [
      { file: "living", folder: "common-area" },
      { file: "bunk", folder: "bedspace" },
      { file: "room", folder: "bedroom" },
    ],
    photoGroups: [
      { label: "Common area", start: 0, count: 1 },
      { label: "Bedspace", start: 1, count: 1 },
      { label: "Bedroom", start: 2, count: 1 },
    ],
  };
  assert.equal(sleepingAreaPhoto(groupedUnit).file, "bunk");
  assert.equal(
    sleepingAreaPhoto({
      id: "1505B",
      photos: [
        { file: "living", folder: "common-area" },
        { file: "room", folder: "bedroom" },
      ],
    }).file,
    "room",
  );
  assert.equal(sleepingAreaPhoto(unit).file, "living-room");
});
test("exact unit lookup preserves route ids and surfaces ambiguous display numbers", () => {
  const units = [
    { id: "1023B" },
    { id: "1633A-1st-floor", unitNumber: "1633A", displayName: "1633A" },
    { id: "1633A-2nd-floor", unitNumber: "1633A", displayName: "1633A" },
  ];
  assert.deepEqual(findUnitsByExactLabel(units, " 1023b "), [units[0]]);
  assert.equal(findUnitsByExactLabel(units, "1633A").length, 2);
  assert.deepEqual(findUnitsByExactLabel(units, "1633A-1st-floor"), [units[1]]);
  assert.deepEqual(findUnitsByExactLabel(units, "9999A"), []);
});
test("every album size uses the same main-photo gallery system", () => {
  const photos = [
    { file: "building", alt: "Building exterior", caption: "The building" },
    { file: "living", alt: "Living room", caption: "Living & dining" },
    { file: "stairs", alt: "Staircase", caption: "Staircase" },
    { file: "sleep", alt: "Bedroom", caption: "Sleeping area" },
    { file: "bath", alt: "Bathroom", caption: "Bathroom" },
    { file: "pool", alt: "Pool", caption: "Pool area" },
  ];
  for (const count of [1, 4, 5, 6]) {
    const variableUnit = {
      id: "1210B",
      photos: photos.slice(0, count),
    };
    const markup = galleryMarkup(variableUnit);
    assert.match(markup, /class="gallery unified-gallery"/);
    assert.match(markup, /class="photo-stage"/);
    assert.match(markup, /class="main-photo"/);
    assert.match(
      markup,
      new RegExp(`class="photo-counter">01 \/ ${String(count).padStart(2, "0")}`),
    );
    assert.equal((markup.match(/class="thumbnail"/g) || []).length, count);
    assert.match(markup, /class="viewer-caption" aria-live="polite"/);
    assert.match(markup, /class="present-album"/);
    assert.match(markup, /class="presentation-controls" hidden/);
    assert.doesNotMatch(markup, /gallery-five|gallery-six|gallery-walkthrough/);
  }
});
test("gallery selectors expose existing captions without requiring a fixed count", () => {
  const variableUnit = {
    id: "1210B",
    photos: [
      { file: "living", alt: "Living room", caption: "Living & dining" },
      { file: "stairs", alt: "Staircase", caption: "Staircase" },
      { file: "sleep", alt: "Bedroom", caption: "Sleeping area" },
      { file: "bath", alt: "Bathroom", caption: "Bathroom" },
    ],
  };
  const markup = galleryMarkup(variableUnit);
  assert.match(markup, /class="photo-counter">01 \/ 04/);
  assert.match(markup, /class="current-caption" aria-live="polite">Living &amp; dining/);
  assert.match(markup, /aria-label="Show Living &amp; dining"/);
  assert.match(markup, /aria-label="Show Bathroom"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /data-index="3"/);
});
test("the building guide shows furnished move-in-ready inclusions", () => {
  const markup = inclusionsSection();
  assert.match(markup, /id="about-included"/);
  assert.match(markup, /Inclusions/);
  assert.match(markup, /All units are furnished and move-in ready/);
  assert.match(markup, /Water/);
  assert.match(markup, /Wifi/);
  assert.match(markup, /Association dues/);
  assert.match(markup, /Rental fee/);
});
test("shared building placeholders live in the building guide, not unit albums", () => {
  const markup = sharedSpacesSection();
  assert.match(markup, /id="about-shared"/);
  assert.match(markup, /Building &amp;/);
  assert.match(markup, /units\/_placeholders\/building\.webp/);
  assert.match(markup, /units\/_placeholders\/pool\.webp/);
  assert.equal((markup.match(/Placeholder image/g) || []).length, 4);
  for (const unit of catalog.units) {
    assert.equal(
      unit.photos.filter((photo) =>
        /^(?:Building exterior|Pool) placeholder$/.test(photo.caption),
      ).length,
      0,
    );
  }
});
test("the building guide shows nearby locations and supplied shared images", () => {
  const markup = nearbyLocationsSection();
  assert.match(markup, /id="about-nearby"/);
  assert.match(markup, /Nearby Locations/);
  assert.match(markup, /Prime location/);
  assert.match(markup, /Ayala Malls/);
  assert.match(markup, /Ayala Central Business District/);
  assert.match(markup, /Makati Medical Center/);
  assert.match(markup, /Ayala Triangle Gardens/);
  assert.match(markup, /Nearby Gyms/);
  assert.match(markup, /Wellness & Fitness Gym/);
  assert.match(markup, /Anytime Fitness Eton Tower/);
  assert.match(markup, /BeFit PNB Makati Center/);
  assert.match(markup, /JJ Fitness Hub/);
  assert.match(markup, /ActivGym Fitness Center Makati/);
  assert.match(markup, /nearby\/gyms\.webp/);
  assert.match(markup, /Gym interior with weight machines/);
  assert.match(markup, /nearby\/malls\.webp/);
  assert.match(markup, /nearby\/offices\.webp/);
  assert.match(markup, /nearby\/commute\.webp/);
  assert.match(markup, /nearby\/makati-medical-center\.webp/);
  assert.match(markup, /nearby\/schools\.webp/);
  assert.match(markup, /nearby\/parks\.webp/);
  assert.match(markup, /Makati Medical Center exterior in Makati/);
  assert.match(markup, /nearby-photo-contain/);
  assert.match(markup, /nearby\/cafes\.webp/);
  assert.match(markup, /width="640" height="360"/);
  assert.doesNotMatch(markup, /nearby-photo-grid/);
});
test("catalog text cannot inject markup", () =>
  assert.equal(
    escapeHtml('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  ));
test("app code does not shadow browser location used by hash routing", () => {
  const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
  assert.doesNotMatch(mainSource, /\bconst\s+location\s*=/);
  assert.match(mainSource, /class="floor-index"/);
  assert.match(mainSource, /class="unit-search"/);
  assert.match(mainSource, /class="about-index"/);
  assert.match(mainSource, /class="album-sequence"/);
  assert.match(mainSource, /class="rental-filters"/);
  assert.match(mainSource, /class="nav-toggle"/);
  assert.match(mainSource, /class="share-unit"/);
  assert.match(mainSource, /floor=\$\{details\.floor\}/);
});
