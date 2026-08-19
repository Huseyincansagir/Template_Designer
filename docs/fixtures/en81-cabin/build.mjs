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

writeFileSync(join(root, "arkaplan.png"), solidPng(720, 1280, 11, 20, 24));

const assets = {
  bg: { id: id("asset"), name: "Kabin arka plan", sourcePath: "assets/arkaplan.png", mediaType: "image" },
  video: { id: id("asset"), name: "Kabin video", sourcePath: "assets/kabin-loop.mp4", mediaType: "video" },
  fire: { id: id("asset"), name: "Yangın işareti", sourcePath: "assets/yangin.jpg", mediaType: "image" },
  noEntry: { id: id("asset"), name: "Girilmez işareti", sourcePath: "assets/girilmez.jpg", mediaType: "image" },
  overload: { id: id("asset"), name: "Aşırı yük işareti", sourcePath: "assets/asiri-yuk.jpg", mediaType: "image" },
  quake: { id: id("asset"), name: "Deprem işareti", sourcePath: "assets/deprem.jpg", mediaType: "image" },
};

const mappingId = id("floor-mapping");
const mapping = {
  id: mappingId,
  entries: [
    { firmwareValue: "B1", displayValue: "B1" },
    { firmwareValue: "0", displayValue: "G" },
    { firmwareValue: "1", displayValue: "1" },
    { firmwareValue: "2", displayValue: "2" },
    { firmwareValue: "3", displayValue: "3" },
    { firmwareValue: "4", displayValue: "4" },
    { firmwareValue: "5", displayValue: "5" },
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
      media("Video", { x: 80, y: 48, width: 560, height: 220 }, 1, A.video.id, "video"),
      direction("Yön", { x: 260, y: 292, width: 200, height: 88 }, 2),
      digit("Kat", { x: 130, y: 400, width: 460, height: 300 }, 3),
      text("Standart", { x: 80, y: 1188, width: 560, height: 56 }, 4, "EN 81-70 konum / yön", "EN 81-70 position / direction"),
    ]),
    scene("Yangın", 10, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      media("Yangın işareti", { x: 210, y: 96, width: 300, height: 300 }, 1, A.fire.id, "image"),
      warning("Yangın", { x: 60, y: 424, width: 600, height: 100 }, 2, "YANGIN", "FIRE"),
      warning("Merdiven", { x: 60, y: 536, width: 600, height: 88 }, 3, "MERDİVEN KULLANIN", "USE THE STAIRS"),
      media("Girilmez işareti", { x: 260, y: 656, width: 200, height: 200 }, 4, A.noEntry.id, "image"),
      warning("Girilmez", { x: 60, y: 880, width: 600, height: 80 }, 5, "GİRİLMEZ", "DO NOT ENTER"),
      warning("Kullanmayın", { x: 60, y: 976, width: 600, height: 80 }, 6, "ASANSÖRÜ KULLANMAYIN", "DO NOT USE THE LIFT"),
    ], fireWhen),
    scene("Aşırı yük", 8, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      digit("Kat", { x: 130, y: 64, width: 460, height: 220 }, 1),
      media("Aşırı yük işareti", { x: 210, y: 312, width: 300, height: 300 }, 2, A.overload.id, "image"),
      warning("Aşırı yük", { x: 60, y: 640, width: 600, height: 110 }, 3, "AŞIRI YÜK", "OVERLOAD"),
      warning("Kapasite", { x: 60, y: 768, width: 600, height: 80 }, 4, "KAPASİTE AŞILDI", "RATED LOAD EXCEEDED"),
    ], overloadWhen),
    scene("Girilmez", 9, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      media("Girilmez işareti", { x: 210, y: 160, width: 300, height: 300 }, 1, A.noEntry.id, "image"),
      warning("Girilmez", { x: 60, y: 496, width: 600, height: 110 }, 2, "GİRİLMEZ", "DO NOT ENTER"),
      warning("Servis dışı", { x: 60, y: 624, width: 600, height: 90 }, 3, "SERVİS DIŞI", "OUT OF SERVICE"),
    ], outWhen),
    Object.assign(scene("Deprem", 7, [
      media("Arka plan", { x: 0, y: 0, width: 720, height: 1280 }, 0, A.bg.id, "image", { locked: true }),
      media("Deprem işareti", { x: 210, y: 160, width: 300, height: 300 }, 1, A.quake.id, "image"),
      warning("Deprem", { x: 60, y: 496, width: 600, height: 110 }, 2, "DEPREM", "EARTHQUAKE"),
      warning("Bekleyin", { x: 60, y: 624, width: 600, height: 90 }, 3, "KABİNDE KALIN", "STAY IN THE CAR"),
    ]), { enabled: false }),
  ];
}

function landscapeScenes() {
  const A = assets;
  return [
    scene("Seyir", 0, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      media("Video", { x: 40, y: 80, width: 400, height: 560 }, 1, A.video.id, "video"),
      direction("Yön", { x: 760, y: 88, width: 200, height: 80 }, 2),
      digit("Kat", { x: 620, y: 188, width: 400, height: 300 }, 3),
      text("Standart", { x: 620, y: 620, width: 400, height: 56 }, 4, "EN 81-70 konum / yön", "EN 81-70 position / direction"),
    ]),
    scene("Yangın", 10, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      media("Yangın işareti", { x: 80, y: 120, width: 320, height: 320 }, 1, A.fire.id, "image"),
      media("Girilmez işareti", { x: 160, y: 460, width: 160, height: 160 }, 2, A.noEntry.id, "image"),
      warning("Yangın", { x: 460, y: 120, width: 760, height: 100 }, 3, "YANGIN", "FIRE"),
      warning("Merdiven", { x: 460, y: 240, width: 760, height: 88 }, 4, "MERDİVEN KULLANIN", "USE THE STAIRS"),
      warning("Girilmez", { x: 460, y: 360, width: 760, height: 80 }, 5, "GİRİLMEZ", "DO NOT ENTER"),
      warning("Kullanmayın", { x: 460, y: 460, width: 760, height: 80 }, 6, "ASANSÖRÜ KULLANMAYIN", "DO NOT USE THE LIFT"),
    ], fireWhen),
    scene("Aşırı yük", 8, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      digit("Kat", { x: 40, y: 160, width: 360, height: 400 }, 1),
      media("Aşırı yük işareti", { x: 480, y: 120, width: 320, height: 320 }, 2, A.overload.id, "image"),
      warning("Aşırı yük", { x: 840, y: 160, width: 400, height: 120 }, 3, "AŞIRI YÜK", "OVERLOAD"),
      warning("Kapasite", { x: 840, y: 320, width: 400, height: 88 }, 4, "KAPASİTE AŞILDI", "RATED LOAD EXCEEDED"),
    ], overloadWhen),
    scene("Girilmez", 9, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      media("Girilmez işareti", { x: 200, y: 160, width: 320, height: 320 }, 1, A.noEntry.id, "image"),
      warning("Girilmez", { x: 600, y: 200, width: 600, height: 120 }, 2, "GİRİLMEZ", "DO NOT ENTER"),
      warning("Servis dışı", { x: 600, y: 360, width: 600, height: 88 }, 3, "SERVİS DIŞI", "OUT OF SERVICE"),
    ], outWhen),
    Object.assign(scene("Deprem", 7, [
      media("Arka plan", { x: 0, y: 0, width: 1280, height: 720 }, 0, A.bg.id, "image", { locked: true }),
      media("Deprem işareti", { x: 200, y: 160, width: 320, height: 320 }, 1, A.quake.id, "image"),
      warning("Deprem", { x: 600, y: 200, width: 600, height: 120 }, 2, "DEPREM", "EARTHQUAKE"),
      warning("Bekleyin", { x: 600, y: 360, width: 600, height: 88 }, 3, "KABİNDE KALIN", "STAY IN THE CAR"),
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
