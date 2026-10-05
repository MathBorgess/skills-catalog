// Beat timeline: durations -> start/end times, subtitles, motion sidecar, explain-data.js and
// the marker rewrites in the composition. Pure functions, no I/O.

import { frameSize } from "./orientation.mjs";

export const AUDIO_START = "<!-- explain:audio:start -->";
export const AUDIO_END = "<!-- explain:audio:end -->";
export const TOKENS_START = "<!-- explain:tokens:start -->";
export const TOKENS_END = "<!-- explain:tokens:end -->";
export const AUDIO_TRACK = 10;
export const BEAT_ID_RE = /^b\d{2,3}$/;
export const SUBJECT_RE = /^#[A-Za-z_][\w-]*$/;
export const DEFAULT_WPM = 150;
export const MIN_BEAT_SEC = 1;

export const round3 = (n) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------------------
// language
// ---------------------------------------------------------------------------

// Request language tag -> Kokoro language, or null when Kokoro has no voice for it (silent video).
export function kokoroLang(tag) {
  const t = String(tag ?? "").trim().toLowerCase().replace(/_/g, "-");
  // Regional tags fall back to the nearest Kokoro voice: Portuguese speech beats a silent video.
  if (t === "pt" || t.startsWith("pt-")) return "pt-br";
  if (t === "en-gb" || t === "en-uk") return "en-gb";
  if (t === "en" || t.startsWith("en-")) return "en-us";
  for (const base of ["es", "fr", "it", "ja", "zh", "hi"]) {
    if (t === base || t.startsWith(`${base}-`)) return base === "fr" ? "fr-fr" : base;
  }
  return null;
}

// ste-lint profile: `en` or `pt`; any other language gets the core rules, so pass its primary subtag.
export function lintLang(tag) {
  const primary = String(tag ?? "").trim().toLowerCase().replace(/_/g, "-").split("-")[0];
  return primary || "en";
}

export function voiceFor(design, kLang) {
  const voices = design?.narration?.voices;
  return kLang && voices && typeof voices[kLang] === "string" ? voices[kLang] : null;
}

// ---------------------------------------------------------------------------
// durations
// ---------------------------------------------------------------------------

export function wordCount(text) {
  const s = String(text ?? "");
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    let n = 0;
    for (const seg of new Intl.Segmenter(undefined, { granularity: "word" }).segment(s)) if (seg.isWordLike) n++;
    return n;
  }
  return s.split(/\s+/).filter(Boolean).length;
}

// Silent runs: reading time at `wpm`, never shorter than MIN_BEAT_SEC.
export function estimateDuration(text, { wpm = DEFAULT_WPM, speed = 1 } = {}) {
  const sec = (wordCount(text) / (wpm * (speed > 0 ? speed : 1))) * 60;
  return round3(Math.max(MIN_BEAT_SEC, sec));
}

// Duration of a PCM/float WAV from its header, or null when the buffer is not a WAV.
export function wavDurationSec(buf) {
  if (!buf || buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let off = 12;
  let byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 16);
    if (id === "data") {
      if (!byteRate) return null;
      if (off + 8 + size > buf.length) size = buf.length - off - 8; // streamed files can carry a bad size
      return round3(size / byteRate);
    }
    off += 8 + size + (size % 2);
  }
  return null;
}

// durations: [{id, dur}] in order. Works in whole milliseconds so sums never drift.
export function buildTimeline(durations, { leadInSec = 0.5, beatGapSec = 0.3, tailSec = 1 } = {}) {
  const ms = (s) => Math.round(s * 1000);
  let cursor = ms(leadInSec);
  const beats = durations.map((d, i) => {
    if (i > 0) cursor += ms(beatGapSec);
    const start = cursor;
    const dur = ms(d.dur);
    cursor += dur;
    return { id: d.id, start: start / 1000, end: cursor / 1000, dur: dur / 1000 };
  });
  return { beats, total: (cursor + ms(tailSec)) / 1000 };
}

// The two frames `render` extracts for every beat, so the agent can look at what the viewer sees:
//   <id>-in.png  the entrance: 40 percent of the way into the beat, at most 1.0 s after it starts
//   <id>.png     settled: 0.1 s before the beat ends, when its motion has stopped
// Both are clamped inside the beat.
export const FRAME_BEFORE_END_SEC = 0.1;
export const ENTRANCE_FRAME_FRACTION = 0.4;
export const ENTRANCE_FRAME_MAX_SEC = 1.0;
const clampToBeat = (beat, at) => round3(Math.min(beat.end, Math.max(beat.start, at)));

export function frameTime(beat) {
  return clampToBeat(beat, beat.end - FRAME_BEFORE_END_SEC);
}

export function entranceFrameTime(beat) {
  const dur = Math.max(0, beat.end - beat.start);
  return clampToBeat(beat, beat.start + Math.min(ENTRANCE_FRAME_MAX_SEC, ENTRANCE_FRAME_FRACTION * dur));
}

// [{id, kind: "in" | "settled", name, at}] in beat order, the entrance frame first; `name` is the PNG's name
// without its extension.
export function inspectionFrames(beats) {
  return beats.flatMap((b) => [
    { id: b.id, kind: "in", name: `${b.id}-in`, at: entranceFrameTime(b) },
    { id: b.id, kind: "settled", name: b.id, at: frameTime(b) },
  ]);
}

// ---------------------------------------------------------------------------
// subtitles
// ---------------------------------------------------------------------------

export function formatSrtTime(sec) {
  const total = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const ms = total % 1000;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(ms, 3)}`;
}

// Wraps a caption to lines of at most `width` characters, as even as possible: the fewest lines
// that fit, then the narrowest width that still gives that many. A word longer than the width is cut.
export function wrapCaption(text, width = 42) {
  const words = String(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const len = (s) => Array.from(s).length;
  const flat = words.join(" ");
  if (len(flat) <= width) return flat;

  const greedy = (w) => {
    const lines = [];
    let line = "";
    const push = () => {
      if (line) lines.push(line);
      line = "";
    };
    for (let word of words) {
      while (len(word) > w) {
        push();
        const chars = Array.from(word);
        lines.push(chars.slice(0, w).join(""));
        word = chars.slice(w).join("");
      }
      if (!line) line = word;
      else if (len(line) + 1 + len(word) <= w) line += ` ${word}`;
      else {
        push();
        line = word;
      }
    }
    push();
    return lines;
  };

  const fewest = greedy(width).length;
  for (let w = Math.ceil(len(flat) / fewest); w < width; w++) {
    const lines = greedy(w);
    if (lines.length <= fewest) return lines.join("\n");
  }
  return greedy(width).join("\n");
}

// One cue per beat, from the same timeline the video uses.
export function buildSrt(beats) {
  return (
    beats
      .map((b, i) => `${i + 1}\n${formatSrtTime(b.start)} --> ${formatSrtTime(b.end)}\n${wrapCaption(b.narration)}\n`)
      .join("\n")
  );
}

// ---------------------------------------------------------------------------
// HyperFrames sidecar and generated files
// ---------------------------------------------------------------------------

// Where the Motion Gate stops looking: the end of the last beat, or null when there are no beats. HyperFrames
// samples the motion pass over [0, sidecar `duration`] and takes the composition's own length (the root
// data-duration, which includes the closing tail) only when the sidecar has none. So the tail, a hold kept on
// purpose after the narration, is never judged; a frozen stretch inside the beats still is.
export function motionWindowEnd(beats) {
  const ends = beats.map((b) => b.end).filter((n) => Number.isFinite(n) && n > 0);
  return ends.length ? round3(Math.max(...ends)) : null;
}

// keepsMoving with the design's static limit, plus one appearsBy per beat subject, over the window of
// motionWindowEnd. `withinSelector` limits the liveness test to one element: burned captions change all the
// time, and only the stage counts.
export function buildMotionJson(beats, { maxStaticSec = 2, withinSelector } = {}) {
  const assertions = [{ kind: "keepsMoving", maxStaticSec, ...(withinSelector ? { withinSelector } : {}) }];
  for (const b of beats) if (b.subject) assertions.push({ kind: "appearsBy", selector: b.subject, bySec: round3(b.start + 0.5) });
  const out = {};
  const until = motionWindowEnd(beats);
  if (until !== null) out.duration = until;
  out.assertions = assertions;
  return out;
}

// `orientation`, `layout` ({safe, captions} boxes of this orientation) and `captions` ({burn, maxWords}) are
// what the kit needs to place and burn captions; width and height come from the orientation.
export function buildExplainData({ lang, silent, total, beats, design, orientation = "landscape", layout, captions }) {
  const row = (b) =>
    `    ${JSON.stringify({ id: b.id, scene: b.scene, start: b.start, end: b.end, dur: b.dur, narration: b.narration, subject: b.subject ?? null })}`;
  const { width, height } = frameSize(orientation);
  const field = (name, value) => (value === undefined ? "" : `  "${name}": ${JSON.stringify(value)},\n`);
  const head =
    `{\n  "lang": ${JSON.stringify(lang)},\n  "silent": ${silent},\n  "orientation": ${JSON.stringify(orientation)},\n  "width": ${width},\n  "height": ${height},\n  "total": ${total},\n` +
    field("layout", layout) +
    field("captions", captions) +
    `  "beats": [\n${beats.map(row).join(",\n")}\n  ],\n  "design": `;
  const designJson = JSON.stringify(design, null, 2).replace(/\n/g, "\n  ");
  return `// Generated by explain.mjs voice. Do not edit: run voice again instead.\nwindow.EXPLAIN = ${head}${designJson}\n};\n`;
}

const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// One <audio> per beat. Every audio needs an id (the mixer only mixes audio[id][src]) and never crossorigin.
export function audioTags(beats) {
  return beats.map(
    (b) =>
      `<audio id="vo-${escapeAttr(b.id)}" src="audio/${escapeAttr(b.id)}.wav" data-start="${b.start}" data-duration="${b.dur}" data-track-index="${AUDIO_TRACK}" data-volume="1"></audio>`
  );
}

export function rewriteAudioRegion(html, tags) {
  const s = html.indexOf(AUDIO_START);
  const e = html.indexOf(AUDIO_END);
  if (s < 0 || e < 0 || e < s) {
    throw new Error(`index.html is missing the ${AUDIO_START} ... ${AUDIO_END} markers; restore them from assets/composition.html`);
  }
  const lineStart = html.lastIndexOf("\n", s) + 1;
  const indent = /^[ \t]*/.exec(html.slice(lineStart, s))[0];
  const inner = tags.length ? `\n${tags.map((t) => indent + t).join("\n")}\n${indent}` : `\n${indent}`;
  return html.slice(0, s + AUDIO_START.length) + inner + html.slice(e);
}

// Sets data-duration on the root element (the one with data-composition-id="explain").
export function rewriteRootDuration(html, total) {
  const re = /<[A-Za-z][\w-]*\b[^>]*\bdata-composition-id\s*=\s*["']explain["'][^>]*>/;
  const m = re.exec(html);
  if (!m) throw new Error('index.html has no root element with data-composition-id="explain"; restore it from assets/composition.html');
  let tag = m[0];
  if (/\bdata-duration\s*=/.test(tag)) tag = tag.replace(/\bdata-duration\s*=\s*(["'])[^"']*\1/, `data-duration="${total}"`);
  else tag = tag.replace(/\s*(\/?)>$/, ` data-duration="${total}"$1>`);
  return html.slice(0, m.index) + tag + html.slice(m.index + m[0].length);
}

// Sets data-width and data-height on the root element, the size HyperFrames renders at.
export function rewriteRootSize(html, width, height) {
  const re = /<[A-Za-z][\w-]*\b[^>]*\bdata-composition-id\s*=\s*["']explain["'][^>]*>/;
  const m = re.exec(html);
  if (!m) throw new Error('index.html has no root element with data-composition-id="explain"; restore it from assets/composition.html');
  let tag = m[0];
  for (const [name, value] of [["data-width", width], ["data-height", height]]) {
    const attr = new RegExp(`\\b${name}\\s*=\\s*(["'])[^"']*\\1`);
    tag = attr.test(tag) ? tag.replace(attr, `${name}="${value}"`) : tag.replace(/\s*(\/?)>$/, ` ${name}="${value}"$1>`);
  }
  return html.slice(0, m.index) + tag + html.slice(m.index + m[0].length);
}

const STAGE_REGION_START = "<!-- explain:stage:start -->";
const STAGE_REGION_END = "<!-- explain:stage:end -->";

// The placeholder stage `new` leaves in the STAGE region: its viewBox and the size its comment names.
// Whatever else the region holds is the agent's and is not touched.
export function rewriteStagePlaceholder(html, width, height) {
  const s = html.indexOf(STAGE_REGION_START);
  const e = html.indexOf(STAGE_REGION_END);
  if (s < 0 || e < s) return html;
  const from = s + STAGE_REGION_START.length;
  // one pass, so the <svg id="stage"> that a comment mentions is never mistaken for the real element
  const region = html.slice(from, e).replace(/<!--[\s\S]*?-->|<svg\b[^>]*\bid\s*=\s*["']stage["'][^>]*>/g, (piece) => {
    if (piece.startsWith("<!--")) return piece.replace(/\b\d{3,4}\s*[x\u00d7]\s*\d{3,4}\b/g, `${width} x ${height}`);
    return /\bviewBox\s*=/.test(piece) ? piece.replace(/\bviewBox\s*=\s*(["'])[^"']*\1/, `viewBox="0 0 ${width} ${height}"`) : piece.replace(/\s*(\/?)>$/, ` viewBox="0 0 ${width} ${height}"$1>`);
  });
  return html.slice(0, from) + region + html.slice(e);
}

// `new` calls this: the root size, the viewport meta and the placeholder stage for the orientation.
export function applyOrientation(html, orientation) {
  const { width, height } = frameSize(orientation);
  const sized = rewriteRootSize(html, width, height).replace(/(<meta\s+name\s*=\s*["']viewport["']\s+content\s*=\s*["'])[^"']*(["'])/i, `$1width=${width}, height=${height}$2`);
  return rewriteStagePlaceholder(sized, width, height);
}

// null when the viewBox of <svg id="stage"> has the aspect of the frame (within 1 percent); otherwise a sentence
// saying what is wrong. A stage authored for the other orientation renders letterboxed and its layout boxes mean nothing.
export function stageFrameMismatch(html, orientation) {
  const tag = /<svg\b[^>]*\bid\s*=\s*["']stage["'][^>]*>/.exec(String(html).replace(/<!--[\s\S]*?-->/g, ""));
  if (!tag) return null;
  const vb = /\bviewBox\s*=\s*["']\s*([^"']*)["']/.exec(tag[0]);
  if (!vb) return null;
  const [, , w, h] = vb[1].trim().split(/[\s,]+/).map(Number);
  if (!(w > 0 && h > 0)) return null;
  const { width, height } = frameSize(orientation);
  if (Math.abs(w / h - width / height) / (width / height) <= 0.01) return null;
  return `the stage viewBox is ${w} x ${h} but this is a ${orientation} run (${width} x ${height}): the stage would be letterboxed. Author it in viewBox 0 0 ${width} ${height}`;
}

// <html lang="..."> for the run's language tag (pt_BR is written pt-BR). A tag that is not a language tag leaves the page alone.
export function htmlLangTag(tag) {
  const t = String(tag ?? "").trim().replace(/_/g, "-");
  return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(t) ? t : null;
}

export function rewriteHtmlLang(html, tag) {
  const lang = htmlLangTag(tag);
  if (!lang) return html;
  return html.replace(/<html\b([^>]*)>/i, (whole, attrs) => {
    if (/\blang\s*=/i.test(attrs)) return `<html${attrs.replace(/\blang\s*=\s*(["'])[^"']*\1/i, `lang="${lang}"`)}>`;
    return `<html lang="${lang}"${attrs}>`;
  });
}

export function hasTokensRegion(html) {
  const s = html.indexOf(TOKENS_START);
  const e = html.indexOf(TOKENS_END);
  return s >= 0 && e > s;
}

// The render embeds fonts only from custom properties in an inline <style> (a linked tokens.css
// is invisible to it), so the head carries the same text as tokens.css between the tokens markers.
export function rewriteTokensRegion(html, css) {
  const s = html.indexOf(TOKENS_START);
  const e = html.indexOf(TOKENS_END);
  if (s < 0 || e < s) throw new Error(`index.html is missing the ${TOKENS_START} ... ${TOKENS_END} markers; restore them from assets/composition.html`);
  const lineStart = html.lastIndexOf("\n", s) + 1;
  const indent = /^[ \t]*/.exec(html.slice(lineStart, s))[0];
  const text = css.endsWith("\n") ? css : `${css}\n`;
  return html.slice(0, s + TOKENS_START.length) + `\n${indent}<style>\n${text}${indent}</style>\n${indent}` + html.slice(e);
}

// `tokens` (the text of tokens.css) is optional: without it the tokens region is left alone. `lang` sets <html lang>.
// The STAGE region and the root size are never touched here.
export function rewriteComposition(html, { tags, total, tokens, lang }) {
  const withAudio = rewriteRootDuration(rewriteAudioRegion(html, tags), total);
  const withTokens = tokens !== undefined && hasTokensRegion(withAudio) ? rewriteTokensRegion(withAudio, tokens) : withAudio;
  return lang === undefined ? withTokens : rewriteHtmlLang(withTokens, lang);
}

// ---------------------------------------------------------------------------
// script.json
// ---------------------------------------------------------------------------

// Returns {errors, beats}; `beats` is normalised ({id, scene, narration, subject}).
export function validateScript(script) {
  const errors = [];
  if (script === null || typeof script !== "object" || Array.isArray(script)) return { errors: ["script.json must be an object with lang, title and beats"], beats: [] };
  if (!Array.isArray(script.beats) || script.beats.length === 0) return { errors: ["script.json needs a non-empty beats list"], beats: [] };
  const seen = new Set();
  let last = -1;
  const beats = [];
  script.beats.forEach((b, i) => {
    const at = `beats[${i}]`;
    if (b === null || typeof b !== "object") return errors.push(`${at} must be an object`);
    if (typeof b.id !== "string" || !BEAT_ID_RE.test(b.id)) errors.push(`${at}.id must look like b01 (got ${JSON.stringify(b.id)})`);
    else {
      if (seen.has(b.id)) errors.push(`${at}.id ${b.id} appears twice`);
      seen.add(b.id);
      const n = Number(b.id.slice(1));
      if (n <= last) errors.push(`${at}.id ${b.id} is out of order; ids must ascend`);
      last = n;
    }
    if (typeof b.narration !== "string" || b.narration.trim() === "") errors.push(`${at} (${b.id ?? "?"}) has no narration; write one sentence`);
    if (b.subject !== undefined && b.subject !== null && !(typeof b.subject === "string" && SUBJECT_RE.test(b.subject))) {
      errors.push(`${at}.subject must be a CSS id selector such as #table (got ${JSON.stringify(b.subject)})`);
    }
    if (b.scene !== undefined && b.scene !== null && typeof b.scene !== "string") errors.push(`${at}.scene must be a string`);
    beats.push({ id: b.id, scene: b.scene ?? "s1", narration: String(b.narration ?? "").replace(/\s+/g, " ").trim(), subject: b.subject ?? null });
  });
  return { errors, beats };
}
