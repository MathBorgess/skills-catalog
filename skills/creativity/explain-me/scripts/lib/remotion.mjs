// Calls into the Remotion CLI as a subprocess: tts, check, render. Remotion is only an
// engine here; no interview, brief, storyboard or sign-in happens.

import path from "node:path";
import fs from "node:fs";

// Variables that keep Remotion quiet and from changing itself. A value the user already set
// (even "0") is left alone.
const QUIET_ENV = {};

export function hfEnv(baseEnv = process.env, extra = {}) {
  const env = { ...baseEnv };
  for (const [k, v] of Object.entries(QUIET_ENV)) if (env[k] === undefined) env[k] = v;
  return { ...env, ...extra };
}

export function hfArgs(resolution, args) {
  return [...(resolution.prefixArgs ?? []), ...args];
}

// First balanced {...} in the text that parses as JSON (the CLI may print notices around it).
export function firstJsonObject(text) {
  const s = String(text ?? "");
  for (let start = s.indexOf("{"); start >= 0; start = s.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    for (let i = start; i < s.length; i++) {
      const ch = s[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

// The last line of stdout that parses as a JSON object (remotion prints other text too).
export function lastJsonObject(text) {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].startsWith("{")) continue;
    try {
      return JSON.parse(lines[i]);
    } catch {
      /* keep looking */
    }
  }
  return firstJsonObject(text);
}

// Local Kokoro Python synthesis for one beat. Text goes through a .txt file so quoting and leading dashes
// can never change what is spoken. Returns {ok, durationSeconds, sampleRate?, error?}.
export function synthesizeBeat(deps, resolution, {textFile, out, voice, lang, speed, python, extraEnv = {}, timeoutMs = 20 * 60 * 1000}) {
  if (!python) return {ok:false, error:"Kokoro requires a local Python interpreter; run setup first"};
  const cache = path.join(deps.homedir, ".cache", "explain-me", "kokoro");
  const model = path.join(cache, "kokoro-v1.0.onnx");
  const voices = path.join(cache, "voices-v1.0.bin");
  if (!deps.fs.existsSync(model) || !deps.fs.existsSync(voices)) return {ok:false, error:"Kokoro weights are missing. Put kokoro-v1.0.onnx and voices-v1.0.bin in " + cache + "; model downloads require explicit setup, not editor installation"};
  const code = `import sys,json
from pathlib import Path
import soundfile as sf
from kokoro_onnx import Kokoro
model,voices,text,out,voice,lang,speed=sys.argv[1:]
audio,sr=Kokoro(model,voices).create(Path(text).read_text(),voice=voice,speed=float(speed),lang=lang)
sf.write(out,audio,sr)
print(json.dumps({"ok":True,"durationSeconds":len(audio)/sr,"sampleRate":sr,"langApplied":lang}))`;
  const x = deps.exec(python, ["-c", code, model, voices, textFile, out, voice, lang, String(speed)], {env:{...deps.env,...extraEnv},timeoutMs});
  const j=lastJsonObject(x.stdout);
  return x.status === 0 && !x.error && j?.ok ? j : {ok:false,error:String(x.stderr||x.stdout||x.error||"Kokoro failed").slice(-800)};
}

// Retained parser for saved historical check envelopes; native Remotion checks use runCheck below.
export function summarizeCheck(envelope) {
  const sections = ["lint", "runtime", "layout", "motion", "contrast"];
  const findings = [];
  let errors = 0;
  let warnings = 0;
  for (const name of sections) {
    const s = envelope?.[name];
    if (!s || typeof s !== "object") continue;
    const list = Array.isArray(s.findings) ? s.findings : [];
    const e = list.filter((f) => f.severity === "error").length;
    const w = list.filter((f) => f.severity === "warning").length;
    errors += Math.max(e, Number(s.errorCount) || 0);
    warnings += Math.max(w, Number(s.warningCount) || 0);
    for (const f of list) {
      if (f.severity === "error" || f.severity === "warning") {
        findings.push({ section: name, severity: f.severity, code: f.code, selector: f.selector ?? null, time: f.time ?? null, message: f.message ?? "", fixHint: f.fixHint ?? null, sourceFile: f.sourceFile ?? null });
      }
    }
  }
  const frozen = sections.reduce((n, name) => n + (envelope?.[name]?.findings ?? []).filter((f) => f.code === "motion_frozen").length, 0);
  return { ok: envelope?.ok === true && errors === 0, errors, warnings, frozen, findings, version: envelope?._meta?.version ?? null };
}

// Generated HTML is a paused, explicit-seek scene hosted by a native Remotion composition.
// New footage edits should use React/Sequence directly. This adapter preserves existing SVG Kit primitives.
export const REMOTION_VERSION = "4.0.535";
export function prepareProject(projectDir) {
  const htmlPath = path.join(projectDir, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const number = (key, fallback) => Number(new RegExp(`data-${key}="([0-9.]+)"`).exec(html)?.[1] ?? fallback);
  const width = number("width",1920), height = number("height",1080), duration = number("duration",10), fps=30;
  const pkgPath=path.join(projectDir,"package.json");
  const old=fs.existsSync(pkgPath)?JSON.parse(fs.readFileSync(pkgPath,"utf8")):{};
  const pkg={...old,name:old.name??"local-remotion-review",private:true,type:"module",scripts:{...old.scripts,dev:"remotion studio remotion-entry.jsx"},dependencies:{...old.dependencies,remotion:REMOTION_VERSION,"@remotion/cli":REMOTION_VERSION,react:"19.2.0","react-dom":"19.2.0",gsap:"3.14.2"}};
  fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");
  const publicDir=path.join(projectDir,"public");fs.mkdirSync(publicDir,{recursive:true});
  // Copy source assets only, never recursively copy the generated project/runtime into itself.
  for(const entry of fs.readdirSync(projectDir,{withFileTypes:true})) {
    if(["node_modules","public","package.json","package-lock.json","remotion-entry.jsx",".git"].includes(entry.name))continue;
    if(entry.name.endsWith(".mp4")||entry.name.endsWith(".png")&&entry.name.startsWith(".check"))continue;
    fs.cpSync(path.join(projectDir,entry.name),path.join(publicDir,entry.name),{recursive:true,dereference:false});
  }
  const sizedHtml=html.replace("<head>",`<head><style>html,body{width:${width}px;height:${height}px;overflow:hidden}#root{width:${width}px;height:${height}px}</style>`);
  const localHtml=sizedHtml.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@[^/]+\/dist\//g,"gsap/");
  fs.writeFileSync(path.join(publicDir,"index.html"),localHtml);
  const gsap=path.join(projectDir,"node_modules","gsap","dist");
  if(fs.existsSync(gsap)) {fs.mkdirSync(path.join(publicDir,"gsap"),{recursive:true});for(const f of fs.readdirSync(gsap))if(f.endsWith(".min.js"))fs.copyFileSync(path.join(gsap,f),path.join(publicDir,"gsap",f));}
  const audio=[...html.matchAll(/<audio\s[^>]*>/g)].map(m=>{const get=k=>new RegExp(`${k}="([^"]*)"`).exec(m[0])?.[1];return {src:get("src"),start:Math.round(Number(get("data-start")??0)*fps),duration:Math.max(1,Math.round(Number(get("data-duration")??duration)*fps))};}).filter(a=>a.src);
  fs.writeFileSync(path.join(projectDir,"remotion-entry.jsx"),`import React, {useRef,useState,useLayoutEffect} from 'react';
import {registerRoot,Composition,AbsoluteFill,Sequence,Html5Audio,staticFile,useCurrentFrame,delayRender,continueRender,cancelRender} from 'remotion';
const audio=${JSON.stringify(audio)};
const Scene=()=>{const ref=useRef(null);const frame=useCurrentFrame();const [ready,setReady]=useState(false);const [handle]=useState(()=>delayRender('Load local scene, fonts and seek bridge'));
 const seek=()=>{const w=ref.current?.contentWindow;if(!w||typeof w.__remotionSeek!=='function')throw new Error('Scene must export __remotionSeek(seconds) after font loading');if(w.__explainKitError)throw new Error(w.__explainKitError);w.__remotionSeek(frame/${fps});};
 useLayoutEffect(()=>{if(ready){try{seek();}catch(e){cancelRender(e);}}},[frame,ready]);
 const load=async()=>{try{const w=ref.current.contentWindow;await w.document.fonts.ready;await Promise.resolve();seek();setReady(true);continueRender(handle);}catch(e){cancelRender(e);}};
 return <AbsoluteFill><iframe ref={ref} src={staticFile('index.html')} onLoad={load} style={{width:${width},height:${height},border:0}}/>{audio.map((a,i)=><Sequence key={i} from={a.start} durationInFrames={a.duration}><Html5Audio src={staticFile(a.src)}/></Sequence>)}</AbsoluteFill>;
};
registerRoot(()=> <Composition id="Scene" component={Scene} width={${width}} height={${height}} fps={${fps}} durationInFrames={${Math.max(1,Math.ceil(duration*fps))}}/>);
`);
  return {width,height,fps,duration};
}
function projectRuntime(resolution,projectDir) {
  const cli=path.join(projectDir,"node_modules","@remotion","cli","remotion-cli.js");
  return fs.existsSync(cli)?{command:process.execPath,prefixArgs:[cli]}:resolution;
}
export function runCheck(deps, resolution, projectDir, {timeoutMs=10*60*1000}={}) {
  prepareProject(projectDir);
  resolution=projectRuntime(resolution,projectDir);
  const x=deps.exec(resolution.command,hfArgs(resolution,["compositions","remotion-entry.jsx","--log=error"]),{cwd:projectDir,env:deps.env,timeoutMs});
  if(x.status!==0||x.error)return {ok:false,crashed:true,errors:1,warnings:0,frozen:0,findings:[],raw:String(x.stderr||x.stdout||x.error).slice(-1200),version:REMOTION_VERSION};
  const still=deps.exec(resolution.command,hfArgs(resolution,["still","remotion-entry.jsx","Scene",path.join(projectDir,".check.png"),"--frame=0","--log=error"]),{cwd:projectDir,env:deps.env,timeoutMs});
  const ok=still.status===0&&!still.error;
  return {ok,crashed:!ok,errors:ok?0:1,warnings:ok?1:0,frozen:0,findings:ok?[{severity:"warning",code:"fidelity_unverified",message:"Composition loading and first-frame runtime only. Inspect movement, contrast, overlap and audible sync in Studio; no automatic fidelity claim."}]:[],raw:String(still.stderr||still.stdout||still.error||"").slice(-1200),version:REMOTION_VERSION};
}
export function runRender(deps,resolution,projectDir,{out,quality="looks",fps,inherit=false,timeoutMs=60*60*1000}) {
  if(fps && fps!==30)return {ok:false,status:1,stderr:"This generated project uses 30fps. Change its timing contract explicitly before rendering."};
  prepareProject(projectDir);
  resolution=projectRuntime(resolution,projectDir);
  const crf={draft:28,looks:20,delivery:16}[quality]??20;
  const x=deps.exec(resolution.command,hfArgs(resolution,["render","remotion-entry.jsx","Scene",out,"--codec=h264",`--crf=${crf}`,"--log=error"]),{cwd:projectDir,env:deps.env,timeoutMs,inherit});
  return {ok:x.status===0&&!x.error,status:x.status,stderr:String(x.stderr||x.stdout||x.error||"").slice(-1200)};
}

export function ffmpegFrame(deps, { video, atSec, out }) {
  const r = deps.exec("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(atSec), "-i", video, "-frames:v", "1", out], { env: deps.env, timeoutMs: 60000 });
  return { ok: r.status === 0 && !r.error, stderr: r.stderr.trim().slice(-400) };
}

export const relativeTo = (base, p) => path.relative(base, p) || ".";
