import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const id = (prefix) => `${prefix}-${randomUUID()}`;

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

/** Solid TFT background. EN 81-70 wants high contrast against digits/arrows. */
function solidPng(width, height, r, g, b) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const digitAssets = Object.fromEntries(Array.from({ length: 10 }, (_, digit) => [
  `d${digit}`,
  { id: id("asset"), name: `digit-${digit}`, sourcePath: `assets/digit-${digit}.png`, mediaType: "image" },
]));

const assets = {
  bg: { id: id("asset"), name: "Kabin arka plan", sourcePath: "assets/arkaplan.jpg", mediaType: "image" },
  logo: { id: id("asset"), name: "SAVAS logo", sourcePath: "assets/savas-logo.png", mediaType: "image" },
  video: { id: id("asset"), name: "Kabin video", sourcePath: "assets/kapi.mp4", mediaType: "video" },
  fire: { id: id("asset"), name: "Yangın işareti", sourcePath: "assets/yangin.jpg", mediaType: "image" },
  noEntry: { id: id("asset"), name: "Girilmez işareti", sourcePath: "assets/girilmez.jpg", mediaType: "image" },
  overload: { id: id("asset"), name: "Aşırı yük işareti", sourcePath: "assets/asiri-yuk.jpg", mediaType: "image" },
  quake: { id: id("asset"), name: "Deprem işareti", sourcePath: "assets/deprem.jpg", mediaType: "image" },
  arrowUp: { id: id("asset"), name: "arrow-up", sourcePath: "assets/arrow-up.png", mediaType: "image" },
  arrowDown: { id: id("asset"), name: "arrow-down", sourcePath: "assets/arrow-down.png", mediaType: "image" },
  dash: { id: id("asset"), name: "digit-dash", sourcePath: "assets/digit-dash.png", mediaType: "image" },
  ...digitAssets,
};

const mappingId = id("floor-mapping");
const mapping = {
  id: mappingId,
  entries: [
    { firmwareValue: "-1", displayValue: "-1" },
    ...Array.from({ length: 17 }, (_, floor) => ({ firmwareValue: String(floor), displayValue: String(floor) })),
  ],
};

function media(name, geo, z, assetId, mediaType, extra = {}) {
  const widgetId = id("widget");
  const slide = mediaType === "video"
    ? {
      mediaSlide: {
        items: [{ id: id("media-item"), mediaType: "video", assetId, duration: 6, loop: true }],
        loop: true,
      },
    }
    : {};
  return {
    id: widgetId,
    name,
    widgetType: "media",
    enabled: true,
    visible: true,
    locked: extra.locked === true,
    geometry: geo,
    zIndex: z,
    bindings: [],
    assetIds: [assetId],
    mediaType,
    ...slide,
  };
}

function digit(name, geo, z) {
  return {
    id: id("widget"),
    name,
    widgetType: "digit",
    enabled: true,
    visible: true,
    locked: false,
    geometry: geo,
    zIndex: z,
    bindings: [],
    assetIds: [],
    content: { sourceStateId: "floor", floorMappingId: mappingId },
    style: { digitStyleId: "digit-default" },
  };
}

function direction(name, geo, z) {
  return {
    id: id("widget"),
    name,
    widgetType: "direction",
    enabled: true,
    visible: true,
    locked: false,
    geometry: geo,
    zIndex: z,
    bindings: [],
    assetIds: [],
    content: { sourceStateId: "direction" },
    style: { directionStyleId: "direction-default" },
  };
}

function warning(name, geo, z, text, textEn) {
  return {
    id: id("widget"),
    name,
    widgetType: "warning",
    enabled: true,
    visible: true,
    locked: false,
    geometry: geo,
    zIndex: z,
    bindings: [],
    assetIds: [],
    content: {
      text,
      textByLanguage: { tr: text, en: textEn },
    },
  };
}

function text(name, geo, z, value, valueEn) {
  return {
    id: id("widget"),
    name,
    widgetType: "text",
    enabled: true,
    visible: true,
    locked: false,
    geometry: geo,
    zIndex: z,
    bindings: [],
    assetIds: [],
    content: {
      text: value,
      textByLanguage: { tr: value, en: valueEn },
    },
  };
}

function scene(name, priority, widgets, conditions = []) {
  return {
    id: id("scene"),
    name,
    widgets,
    priority,
    enabled: true,
    activationConditions: conditions,
    activationConditionMode: "all",
  };
}

const fireWhen = [{ source: "state", stateId: "fire", operator: "equals", value: true }];
const overloadWhen = [{ source: "state", stateId: "service_state", operator: "equals", value: "overload" }];
const outWhen = [{ source: "state", stateId: "service_state", operator: "equals", value: "service_out" }];

function portraitScenes() {
  const A = assets;
  return [
    scene("Seyir", 0, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      media("Logo", { x: 160, y: 28, width: 400, height: 120 }, 1, A.logo.id, "image"),
      digit("Kat", { x: 80, y: 156, width: 560, height: 280 }, 3),
      direction("Yön", { x: 250, y: 444, width: 220, height: 100 }, 2),
      media("Video", { x: 80, y: 560, width: 560, height: 312 }, 1, A.video.id, "video"),
      text("Kapasite", { x: 80, y: 892, width: 560, height: 56 }, 4, "1000 kg · 13 kişi", "1000 kg · 13 persons"),
      text("Standart", { x: 80, y: 964, width: 560, height: 52 }, 4, "EN 81-70 · EN 81-20", "EN 81-70 · EN 81-20"),
    ]),
    scene("Yangın", 10, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      media("Yangın işareti", { x: 210, y: 120, width: 300, height: 300 }, 1, A.fire.id, "image"),
      warning("Yangın", { x: 80, y: 448, width: 560, height: 96 }, 2, "YANGIN", "FIRE"),
      text("Merdiven", { x: 80, y: 560, width: 560, height: 56 }, 3, "MERDİVEN KULLANIN", "USE THE STAIRS"),
      media("Girilmez işareti", { x: 260, y: 640, width: 200, height: 200 }, 4, A.noEntry.id, "image"),
      warning("Girilmez", { x: 80, y: 864, width: 560, height: 80 }, 5, "GİRİLMEZ", "DO NOT ENTER"),
      text("Kullanmayın", { x: 80, y: 960, width: 560, height: 64 }, 6, "ASANSÖRÜ KULLANMAYIN", "DO NOT USE THE LIFT"),
    ], fireWhen),
    scene("Aşırı yük", 8, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      digit("Kat", { x: 130, y: 48, width: 460, height: 200 }, 1),
      media("Aşırı yük işareti", { x: 210, y: 272, width: 300, height: 300 }, 2, A.overload.id, "image"),
      warning("Aşırı yük", { x: 80, y: 600, width: 560, height: 100 }, 3, "AŞIRI YÜK", "OVERLOAD"),
      text("Kapasite", { x: 80, y: 720, width: 560, height: 64 }, 4, "KAPASİTE AŞILDI", "RATED LOAD EXCEEDED"),
    ], overloadWhen),
    scene("Girilmez", 9, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      media("Girilmez işareti", { x: 210, y: 180, width: 300, height: 300 }, 1, A.noEntry.id, "image"),
      warning("Girilmez", { x: 80, y: 520, width: 560, height: 100 }, 2, "GİRİLMEZ", "DO NOT ENTER"),
      text("Servis dışı", { x: 80, y: 640, width: 560, height: 72 }, 3, "SERVİS DIŞI", "OUT OF SERVICE"),
    ], outWhen),
    Object.assign(scene("Deprem", 7, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      media("Deprem işareti", { x: 210, y: 180, width: 300, height: 300 }, 1, A.quake.id, "image"),
      warning("Deprem", { x: 80, y: 520, width: 560, height: 100 }, 2, "DEPREM", "EARTHQUAKE"),
      text("Bekleyin", { x: 80, y: 640, width: 560, height: 72 }, 3, "KABİNDE KALIN", "STAY IN THE CAR"),
    ]), { enabled: false }),
  ];
}

function landscapeScenes() {
  const A = assets;
  return [
    scene("Seyir", 0, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      media("Video", { x: 32, y: 80, width: 500, height: 560 }, 1, A.video.id, "video"),
      media("Logo", { x: 700, y: 24, width: 400, height: 120 }, 1, A.logo.id, "image"),
      digit("Kat", { x: 580, y: 160, width: 640, height: 240 }, 3),
      direction("Yön", { x: 800, y: 416, width: 200, height: 88 }, 2),
      text("Kapasite", { x: 580, y: 520, width: 640, height: 56 }, 4, "1000 kg · 13 kişi", "1000 kg · 13 persons"),
      text("Standart", { x: 580, y: 592, width: 640, height: 48 }, 4, "EN 81-70 · EN 81-20", "EN 81-70 · EN 81-20"),
    ]),
    scene("Yangın", 10, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      media("Yangın işareti", { x: 80, y: 80, width: 320, height: 320 }, 1, A.fire.id, "image"),
      media("Girilmez işareti", { x: 160, y: 440, width: 160, height: 160 }, 2, A.noEntry.id, "image"),
      warning("Yangın", { x: 460, y: 100, width: 760, height: 100 }, 3, "YANGIN", "FIRE"),
      text("Merdiven", { x: 460, y: 220, width: 760, height: 64 }, 4, "MERDİVEN KULLANIN", "USE THE STAIRS"),
      warning("Girilmez", { x: 460, y: 320, width: 760, height: 80 }, 5, "GİRİLMEZ", "DO NOT ENTER"),
      text("Kullanmayın", { x: 460, y: 420, width: 760, height: 64 }, 6, "ASANSÖRÜ KULLANMAYIN", "DO NOT USE THE LIFT"),
    ], fireWhen),
    scene("Aşırı yük", 8, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      digit("Kat", { x: 40, y: 160, width: 360, height: 400 }, 1),
      media("Aşırı yük işareti", { x: 460, y: 120, width: 320, height: 320 }, 2, A.overload.id, "image"),
      warning("Aşırı yük", { x: 820, y: 160, width: 420, height: 120 }, 3, "AŞIRI YÜK", "OVERLOAD"),
      text("Kapasite", { x: 820, y: 320, width: 420, height: 72 }, 4, "KAPASİTE AŞILDI", "RATED LOAD EXCEEDED"),
    ], overloadWhen),
    scene("Girilmez", 9, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      media("Girilmez işareti", { x: 200, y: 160, width: 320, height: 320 }, 1, A.noEntry.id, "image"),
      warning("Girilmez", { x: 600, y: 200, width: 600, height: 120 }, 2, "GİRİLMEZ", "DO NOT ENTER"),
      text("Servis dışı", { x: 600, y: 360, width: 600, height: 72 }, 3, "SERVİS DIŞI", "OUT OF SERVICE"),
    ], outWhen),
    Object.assign(scene("Deprem", 7, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      media("Deprem işareti", { x: 200, y: 160, width: 320, height: 320 }, 1, A.quake.id, "image"),
      warning("Deprem", { x: 600, y: 200, width: 600, height: 120 }, 2, "DEPREM", "EARTHQUAKE"),
      text("Bekleyin", { x: 600, y: 360, width: 600, height: 72 }, 3, "KABİNDE KALIN", "STAY IN THE CAR"),
    ]), { enabled: false }),
  ];
}

const projectId = id("project");
const themeId = id("theme");
const groupId = id("theme-group");
const rotations = [
  { id: id("rotation"), angle: 0, width: 720, height: 1280, scenes: portraitScenes() },
  { id: id("rotation"), angle: 90, width: 1280, height: 720, scenes: landscapeScenes() },
  { id: id("rotation"), angle: 180, width: 720, height: 1280, scenes: portraitScenes() },
  { id: id("rotation"), angle: 270, width: 1280, height: 720, scenes: landscapeScenes() },
];

const project = {
  id: projectId,
  schemaVersion: 1,
  name: "EN 81 Kabin Göstergesi",
  deviceProfileId: "foundation-profile",
  deviceProfileVersion: "1.0",
  themeProjectGroups: [{
    id: groupId,
    name: "Kabin temaları",
    themeProjects: [{
      id: themeId,
      name: "EN 81 Kabin",
      rotations,
      resources: Object.values(assets).map((asset) => asset.id),
      floorMappings: [mapping],
    }],
  }],
  assets: Object.values(assets).map((asset) => ({
    ...asset,
    metadata: { originalFileName: asset.sourcePath.replace(/^assets\//, ""), typeInferred: true },
  })),
  metadata: {
    note: "EN 81-20 overload, EN 81-70 position/direction, EN 81-73 fire, EN 81-77 earthquake layout (disabled until a seismic runtime state exists).",
  },
};

writeFileSync(join(root, "en81-cabin.tdproj.json"), JSON.stringify(project, null, 2));
writeFileSync(join(root, "project-id.txt"), projectId);
console.log("wrote", join(root, "en81-cabin.tdproj.json"), "project", projectId);
