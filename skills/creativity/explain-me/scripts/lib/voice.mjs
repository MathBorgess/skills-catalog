// `voice`: script.json -> lint -> per-beat audio (or estimated durations) -> timeline ->
// explain-data.js, audio tags, root duration, motion sidecar and subtitles.
// Synthesis and linting are injected so the whole flow runs in tests without HyperFrames.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { explainDesign, hasAmbient } from "./design.mjs";
import { resolveLayout, runOrientation } from "./orientation.mjs";
import { projectDir, readProjectDesign, readRun, sha256, updateRun, writeJson } from "./run.mjs";
import {
  audioTags,
  buildExplainData,
  buildMotionJson,
  buildSrt,
  buildTimeline,
  estimateDuration,
  hasTokensRegion,
  kokoroLang,
  lintLang,
  motionWindowEnd,
  rewriteComposition,
  round3,
  validateScript,
  voiceFor,
  wavDurationSec,
} from "./timeline.mjs";

const STAGE_START = "<!-- explain:stage:start -->";
const STAGE_END = "<!-- explain:stage:end -->";

export function stageIds(html) {
  const s = html.indexOf(STAGE_START);
  const e = html.indexOf(STAGE_END);
  if (s < 0 || e < s) return new Set();
  return new Set([...html.slice(s, e).matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]));
}

const cacheKey = (text, voice, lang, speed) => crypto.createHash("sha1").update(`${voice}\0${lang}\0${speed}\0${text}`).digest("hex");

// synth(beat, outPath, {voice, lang, speed}) -> {ok, durationSeconds, error}
// lint(text, {lang, narration, strict, glossary}) -> {errors, warnings} (may be async)
export async function runVoice({ runDir, synth, lint, strict = false, glossary, forceSilent = false }) {
  const run = readRun(runDir);
  const project = projectDir(runDir);

  let script;
  let scriptHash;
  try {
    const text = fs.readFileSync(path.join(runDir, "script.json"), "utf8");
    scriptHash = sha256(text); // the guard: check and render refuse a script that no longer matches this
    script = JSON.parse(text);
  } catch (e) {
    return { ok: false, stage: "script", errors: [`cannot read script.json: ${e.message}`] };
  }
  const checked = validateScript(script);
  if (checked.errors.length) return { ok: false, stage: "script", errors: checked.errors };
  const beats = checked.beats;

  const lang = typeof script.lang === "string" && script.lang.trim() ? script.lang.trim() : run.lang;
  const title = typeof script.title === "string" && script.title.trim() ? script.title.trim() : run.title ?? "";
  const kLang = kokoroLang(lang);
  const design = readProjectDesign(project);
  const voice = voiceFor(design, kLang);
  const silent = Boolean(forceSilent || !kLang || !voice);
  const silentReason = forceSilent ? "requested" : !kLang ? `no Kokoro voice for ${lang}` : !voice ? `design has no voice for ${kLang}` : null;
  const speed = typeof design.narration?.speed === "number" ? design.narration.speed : 1;
  const orientation = runOrientation(run); // a run made before orientation existed is landscape
  const { layout, captions } = resolveLayout(design, orientation);

  // 1. Lint every narration before any audio exists. Errors stop the command.
  const lintFailures = [];
  const lintWarnings = [];
  for (const b of beats) {
    const r = await lint(b.narration, { lang: lintLang(lang), narration: true, strict, glossary });
    if (r.errors?.length) lintFailures.push({ beat: b.id, narration: b.narration, errors: r.errors });
    for (const w of r.warnings ?? []) lintWarnings.push({ beat: b.id, ...w });
  }
  if (lintFailures.length) return { ok: false, stage: "lint", lintFailures, lintWarnings };

  // 2. Durations: Kokoro per beat, or reading-time estimates for a silent run.
  const audioDir = path.join(project, "audio");
  const previousCache = run.voiceCache && typeof run.voiceCache === "object" ? run.voiceCache : {};
  const voiceCache = {};
  const durations = [];
  let synthesized = 0;
  let reused = 0;
  if (silent) {
    for (const b of beats) durations.push({ id: b.id, dur: estimateDuration(b.narration, { speed }) });
  } else {
    fs.mkdirSync(audioDir, { recursive: true });
    for (const b of beats) {
      const out = path.join(audioDir, `${b.id}.wav`);
      const key = cacheKey(b.narration, voice, kLang, speed);
      const cached = previousCache[b.id];
      if (cached && cached.key === key && fs.existsSync(out)) {
        durations.push({ id: b.id, dur: cached.dur });
        voiceCache[b.id] = cached;
        reused++;
        continue;
      }
      const r = await synth(b, out, { voice, lang: kLang, speed });
      if (!r.ok) return { ok: false, stage: "tts", beat: b.id, error: r.error };
      if (!fs.existsSync(out)) return { ok: false, stage: "tts", beat: b.id, error: `hyperframes tts reported success but ${out} does not exist` };
      let dur = round3(r.durationSeconds);
      const header = wavDurationSec(fs.readFileSync(out));
      if (header !== null && Math.abs(header - dur) > 0.05) dur = header; // the file is the truth
      durations.push({ id: b.id, dur });
      voiceCache[b.id] = { key, dur };
      synthesized++;
    }
  }
  // audio left over from beats that no longer exist (or from a previous non-silent run)
  try {
    const keep = new Set(silent ? [] : beats.map((b) => `${b.id}.wav`));
    for (const f of fs.readdirSync(audioDir)) if (/^b\d{2,3}\.wav$/.test(f) && !keep.has(f)) fs.unlinkSync(path.join(audioDir, f));
  } catch {
    /* no audio dir yet */
  }

  // 3. Timeline from the design's timing tokens.
  const motion = design.motion ?? {};
  const timeline = buildTimeline(durations, { leadInSec: motion.leadInSec, beatGapSec: motion.beatGapSec, tailSec: motion.tailSec });
  const full = beats.map((b, i) => ({ ...b, ...timeline.beats[i] }));

  // 4. Write everything derived from it.
  const htmlPath = path.join(project, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  // the tokens region is rewritten here too, from tokens.css, so index.html never drifts from it
  let tokens;
  try {
    tokens = fs.readFileSync(path.join(project, "tokens.css"), "utf8");
  } catch {
    /* no tokens.css: leave the region alone */
  }
  fs.writeFileSync(htmlPath, rewriteComposition(html, { tags: silent ? [] : audioTags(full), total: timeline.total, tokens, lang }));
  fs.writeFileSync(path.join(project, "explain-data.js"), buildExplainData({ lang, silent, total: timeline.total, beats: full, design: explainDesign(design), orientation, layout, captions }));
  // burned captions and an ambient glow change all the time, so with either only the stage has to keep moving;
  // the gate stops at the end of the last beat, so the closing tail (a deliberate hold) is never judged
  const stageOnly = captions.burn || hasAmbient(motion);
  writeJson(path.join(project, "index.motion.json"), buildMotionJson(full, { maxStaticSec: motion.maxStaticSec ?? 2, withinSelector: stageOnly ? "#stage" : undefined }));
  const srtPath = path.join(runDir, `${run.slug}.srt`);
  fs.writeFileSync(srtPath, buildSrt(full));

  const warnings = lintWarnings.map((w) => ({ beat: w.beat, rule: w.rule, message: w.message }));
  if (tokens !== undefined && !hasTokensRegion(html)) warnings.push({ beat: "-", rule: "tokens-region-missing", message: "index.html has no explain:tokens markers, so brand fonts will not reach the render; restore them from assets/composition.html" });
  const ids = stageIds(html);
  if (ids.size) {
    for (const b of full) if (b.subject && !ids.has(b.subject.slice(1))) warnings.push({ beat: b.id, rule: "subject-missing", message: `subject ${b.subject} is not in the STAGE region of index.html yet` });
  }

  updateRun(runDir, {
    lang,
    kokoroLang: kLang,
    voice: silent ? null : voice,
    title,
    silent,
    timeline: { total: timeline.total, beats: full.length },
    scriptHash,
    voiceCache,
  });

  return {
    ok: true,
    lang,
    kokoroLang: kLang,
    voice: silent ? null : voice,
    silent,
    silentReason,
    orientation,
    captions,
    total: timeline.total,
    motionUntil: motionWindowEnd(full),
    beats: full.map(({ id, start, end, dur }) => ({ id, start, end, dur })),
    synthesized,
    reused,
    files: {
      explainData: path.join(project, "explain-data.js"),
      motion: path.join(project, "index.motion.json"),
      index: htmlPath,
      srt: srtPath,
      audio: silent ? [] : full.map((b) => path.join(audioDir, `${b.id}.wav`)),
    },
    warnings,
  };
}
