// Orientation: the frame shape of a video. `landscape` is 16:9 (1920 x 1080, the default), `portrait` is
// 9:16 (1080 x 1920, for Reels, Shorts and TikTok). Not to be confused with --format (video, svg, html...).
// Pure functions, no I/O. A run created before orientation existed has no `orientation` in run.json and
// is a landscape run.

export const ORIENTATIONS = ["landscape", "portrait"];
export const DEFAULT_ORIENTATION = "landscape";
export const FRAME_SIZES = { landscape: { width: 1920, height: 1080 }, portrait: { width: 1080, height: 1920 } };

const ALIASES = {
  landscape: "landscape",
  horizontal: "landscape",
  "16:9": "landscape",
  portrait: "portrait",
  vertical: "portrait",
  "9:16": "portrait",
  reels: "portrait",
  shorts: "portrait",
  tiktok: "portrait",
};
export const ORIENTATION_ALIASES = Object.keys(ALIASES);

// "Vertical", " 9:16 " -> "portrait"; anything unknown -> null.
export function normalizeOrientation(value) {
  if (typeof value !== "string") return null;
  return ALIASES[value.trim().toLowerCase()] ?? null;
}

export const orientationUsage = () => `--orientation must be landscape or portrait (aliases: ${ORIENTATION_ALIASES.filter((a) => !ORIENTATIONS.includes(a)).join(", ")})`;

export const frameSize = (orientation) => FRAME_SIZES[orientation] ?? FRAME_SIZES[DEFAULT_ORIENTATION];

// The orientation of a run, landscape for a run.json that predates the field.
export function runOrientation(run) {
  return normalizeOrientation(run?.orientation) ?? DEFAULT_ORIENTATION;
}

// Fallbacks for a design that has no layout or captions block (the shipped assets/DESIGN.md carries the
// real values and wins in every normal run). Boxes are [x0, y0, x1, y1] in stage units.
export const DEFAULT_LAYOUT = {
  landscape: { safe: [120, 120, 1800, 960], captions: [160, 900, 1760, 1030] },
  portrait: { safe: [60, 220, 960, 1380], captions: [60, 1400, 960, 1580] },
};
export const DEFAULT_CAPTIONS = { burn: { landscape: false, portrait: true }, maxWords: 6 };

const isBox = (b) => Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number" && Number.isFinite(n));

// What explain-data.js carries for one orientation: the two boxes and the burn switch resolved for it.
export function resolveLayout(design, orientation) {
  const layout = design?.layout?.[orientation] ?? {};
  const fallback = DEFAULT_LAYOUT[orientation] ?? DEFAULT_LAYOUT[DEFAULT_ORIENTATION];
  const burn = design?.captions?.burn?.[orientation];
  const maxWords = design?.captions?.maxWords;
  return {
    layout: { safe: isBox(layout.safe) ? [...layout.safe] : [...fallback.safe], captions: isBox(layout.captions) ? [...layout.captions] : [...fallback.captions] },
    captions: {
      burn: typeof burn === "boolean" ? burn : DEFAULT_CAPTIONS.burn[orientation] ?? false,
      maxWords: Number.isInteger(maxWords) && maxWords >= 1 ? maxWords : DEFAULT_CAPTIONS.maxWords,
    },
  };
}
