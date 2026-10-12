/*!
 * ExplainKit - the 3b1b motion kit of explain-me.
 *
 * Loaded by the composition after tokens.css, GSAP and its plugins, and explain-data.js.
 * It turns one beat script into ONE paused GSAP timeline registered at
 * window.__timelines["explain"], so every agent gets the same motion floor:
 *
 *   const kit = ExplainKit.create();
 *   kit.beat("b01", (b) => {
 *     b.draw("#axis");                        // stroke drawn on
 *     b.write("#label");                      // text written character by character
 *     b.at(1.2).morph("#square", "#circle");  // .at(sec) = seconds from the beat start
 *   });
 *   kit.register();
 *
 * The nine primitives are draw, write, morph, move, camera, indicate, count, grow and fade.
 * Each takes { dur, ease }; defaults come from window.EXPLAIN.design.motion: durations per primitive, and
 * the ease of the call's role (motion.eases.enter, .exit, .emphasis), else motion.ease.
 * When window.EXPLAIN.captions.burn is true the kit also fills <div id="captions"> with the
 * narration as timed caption chunks (see buildCaptions); the stage and the camera never touch it.
 * The camera frames its focus inside the design's safe zone, and after the build the kit samples the
 * timeline and reports stage content that sits in the caption band or outside the safe zone (auditStage).
 * No randomness, no clocks, no infinite repeats, no idle loops on the stage (an ambient level only drifts
 * a glow behind it, and the Motion Gate never counts that glow): every frame is a
 * function of the playhead time alone (HyperFrames determinism rules).
 */
(function (global) {
  "use strict";

  var VERSION = "2.3.0";
  var PRIMITIVES = ["draw", "write", "morph", "move", "camera", "indicate", "count", "grow", "fade"];
  var DEFAULT_DURATIONS = { draw: 1.2, write: 0.9, morph: 1.0, move: 1.2, camera: 1.5, indicate: 0.6, count: 1.0, grow: 0.6, fade: 0.5 };
  var DEFAULT_EASE = "power2.inOut";
  var EASE_ROLES = ["enter", "exit", "emphasis"];
  // A motion identity's ambient level: a slow glow drifting behind the stage. Its period is long and its
  // repeat count finite, so it stays a function of the playhead; the Motion Gate never counts it as motion.
  var AMBIENT = {
    subtle: { period: 9, shift: 4, scale: 1.08, opacity: 0.22 },
    lively: { period: 5, shift: 8, scale: 1.16, opacity: 0.38 }
  };
  var STAGE_ID = "stage";
  var STAGE_W = 1920; // the landscape default, used when explain-data.js carries no width and height
  var STAGE_H = 1080;
  var CAPTION_FADE_IN = 0.12;
  var CAPTION_FADE_OUT = 0.08;
  var AUDIT_STEP = 0.25;       // seconds between the samples of the stage audit
  var AUDIT_MIN_OPACITY = 0.05; // below this an element does not count as visible
  var BAND_TOLERANCE = 8;      // stage units a box may overlap the caption band before it is reported
  var SAFE_TOLERANCE = 16;     // stage units a box may leave the safe zone: glyph boxes carry some padding
  var BAND_BLOCKING_SEC = 0.5; // an overlap with the caption band this long is an error; a shorter one is a warning
  var AUDIT_MAX_REPORTS = 8;
  var SHAPE = { path: 1, line: 1, polyline: 1, polygon: 1, rect: 1, circle: 1, ellipse: 1 };
  var LEAF = { text: 1, image: 1, use: 1, foreignobject: 1 };
  var NOT_DRAWN = { defs: 1, title: 1, desc: 1, style: 1, script: 1, clippath: 1, mask: 1, marker: 1, lineargradient: 1, radialgradient: 1, pattern: 1, symbol: 1, metadata: 1 };
  var OPTION_KEYS = {
    draw: ["dur", "duration", "ease", "stagger", "from", "out"],
    write: ["dur", "duration", "ease", "stagger", "charDur"],
    morph: ["dur", "duration", "ease", "shapeIndex", "type", "style"],
    move: ["dur", "duration", "ease", "along", "start", "end", "rotate", "to", "by", "align"],
    camera: ["dur", "duration", "ease", "x", "y", "w", "h", "focus", "pad", "zoom", "cx", "cy", "reset"],
    indicate: ["dur", "duration", "ease", "scale", "color"],
    count: ["dur", "duration", "ease", "from", "to", "decimals", "prefix", "suffix", "format", "locale"],
    grow: ["dur", "duration", "ease", "origin", "axis", "from", "out", "stagger"],
    fade: ["dur", "duration", "ease", "out", "to", "from", "shift", "stagger"]
  };

  /* ------------------------------------------------------------------ errors */

  function fail(message) {
    var error = new Error("explain-kit: " + message);
    error.explainKit = true;
    throw error;
  }

  function warn(message) {
    if (global.console && console.warn) console.warn("explain-kit: " + message);
  }

  // A finding that must stop the render: HyperFrames counts a console error as a runtime error, so `check`
  // fails on it. Nothing throws, so the page and the render itself keep working.
  function problem(message) {
    if (global.console && console.error) console.error("explain-kit: " + message);
  }

  // A layout box [x0, y0, x1, y1] in stage units, or null when it is not four numbers in order.
  function boxOf(b) {
    var ok = Array.isArray(b) && b.length === 4 && b.every(function (n) { return typeof n === "number" && isFinite(n); });
    return ok && b[2] > b[0] && b[3] > b[1] ? b : null;
  }

  function round(n, places) {
    var k = Math.pow(10, places == null ? 3 : places);
    return Math.round(n * k) / k;
  }

  function num(value, fallback) {
    var n = typeof value === "number" ? value : parseFloat(value);
    return isFinite(n) ? n : fallback;
  }

  /* ----------------------------------------------------------------- config */

  function readConfig() {
    var data = global.EXPLAIN;
    if (!data || !Array.isArray(data.beats)) {
      fail("window.EXPLAIN is missing. explain-data.js must load before kit.js (run `explain.mjs voice <run>` to generate it).");
    }
    var design = data.design || {};
    var motion = design.motion || {};
    var durations = {};
    PRIMITIVES.forEach(function (name) {
      durations[name] = num((motion.durations || {})[name], DEFAULT_DURATIONS[name]);
    });
    var byId = {};
    data.beats.forEach(function (beat) { byId[beat.id] = beat; });
    // Older explain-data.js files carry none of these: treat them as landscape 1920 x 1080 with no burned captions.
    var width = num(data.width, STAGE_W);
    var height = num(data.height, STAGE_H);
    var capData = data.captions || {};
    return {
      data: data,
      beats: data.beats,
      byId: byId,
      total: num(data.total, 0),
      width: width,
      height: height,
      orientation: data.orientation || (height > width ? "portrait" : "landscape"),
      layout: data.layout || null,
      captions: { burn: capData.burn === true, maxWords: Math.max(1, Math.floor(num(capData.maxWords, 6))) },
      lang: data.lang || "en",
      durations: durations,
      ease: motion.ease || DEFAULT_EASE,
      eases: easesByRole(motion.eases),
      ambient: Object.prototype.hasOwnProperty.call(AMBIENT, motion.ambient) ? motion.ambient : "none",
      maxStatic: num(motion.maxStaticSec, 2),
      colors: design.colors || {}
    };
  }

  function requirePlugins() {
    if (typeof global.gsap === "undefined") fail("GSAP did not load. Check the <script> tags in the head of index.html.");
    var missing = [];
    ["DrawSVGPlugin", "MorphSVGPlugin", "MotionPathPlugin", "SplitText"].forEach(function (name) {
      if (typeof global[name] === "undefined") missing.push(name);
    });
    if (missing.length) fail("GSAP plugins did not load: " + missing.join(", ") + ". Check the <script> tags in the head of index.html.");
    gsap.registerPlugin(DrawSVGPlugin, MorphSVGPlugin, MotionPathPlugin, SplitText);
  }

  /* ---------------------------------------------------------------- helpers */

  // motion.eases names one GSAP ease per role; a role it leaves out falls back to motion.ease.
  function easesByRole(eases) {
    var out = {};
    EASE_ROLES.forEach(function (role) {
      var v = eases && typeof eases === "object" ? eases[role] : null;
      out[role] = typeof v === "string" && v.trim() ? v.trim() : null;
    });
    return out;
  }

  // Which role a call plays: an entrance decelerates, an exit accelerates, an emphasis overshoots. Moves,
  // morphs, camera pushes, counts and dims keep the base ease. write ignores ease (its characters fade).
  function easeRole(prim, opts) {
    if (prim === "indicate") return "emphasis";
    if ((prim === "draw" || prim === "grow" || prim === "fade") && opts.out) return "exit";
    if (prim === "draw" || prim === "grow") return "enter";
    if (prim === "fade" && opts.to == null) return "enter";
    return null;
  }

  function tagOf(el) {
    return (el.localName || el.tagName || "").toLowerCase();
  }

  function isSvg(el) {
    return el.namespaceURI === "http://www.w3.org/2000/svg";
  }

  function inDocumentOrder(a, b) {
    if (a === b) return 0;
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }

  function describe(sel) {
    if (typeof sel === "string") return JSON.stringify(sel);
    if (sel && sel.nodeType === 1) return "<" + tagOf(sel) + (sel.id ? " id=" + sel.id : "") + ">";
    return "(" + typeof sel + ")";
  }

  function resolve(sel, where) {
    var list;
    if (typeof sel === "string") {
      try {
        list = Array.prototype.slice.call(document.querySelectorAll(sel));
      } catch (e) {
        fail(where + ": " + describe(sel) + " is not a valid CSS selector (" + e.message + ").");
      }
    } else if (sel && sel.nodeType === 1) {
      list = [sel];
    } else if (sel && typeof sel.length === "number" && typeof sel !== "function") {
      list = Array.prototype.slice.call(sel);
    } else {
      fail(where + ": expected a CSS selector or element, got " + describe(sel) + ".");
    }
    if (!list.length) {
      fail(where + ": selector " + describe(sel) + " matches nothing. Add that element to the STAGE region or fix the selector.");
    }
    return list;
  }

  function cssColor(el, prop) {
    var v = getComputedStyle(el)[prop];
    return !v || v === "none" ? null : v;
  }

  function hasStroke(el) {
    var cs = getComputedStyle(el);
    return !!cs.stroke && cs.stroke !== "none" && num(cs.strokeWidth, 1) > 0 && num(cs.strokeOpacity, 1) > 0;
  }

  function hasFill(el) {
    var cs = getComputedStyle(el);
    return !!cs.fill && cs.fill !== "none" && num(cs.fillOpacity, 1) > 0;
  }

  // Leaves of a target in document order: drawable shapes and text-like leaves.
  function collectLeaves(targets) {
    var out = [];
    var seen = [];
    function add(el) {
      if (seen.indexOf(el) === -1) { seen.push(el); out.push(el); }
    }
    targets.forEach(function (el) {
      var tag = tagOf(el);
      if (SHAPE[tag] || LEAF[tag]) { add(el); return; }
      if (NOT_DRAWN[tag]) return;
      Array.prototype.forEach.call(el.querySelectorAll("*"), function (child) {
        var t = tagOf(child);
        if (SHAPE[t] || LEAF[t]) {
          // a tspan or shape inside <defs>/<clipPath>/<marker> is never drawn
          if (child.closest("defs, clipPath, mask, marker, symbol, pattern")) return;
          add(child);
        }
      });
      if (!isSvg(el)) add(el);
    });
    return out.sort(inDocumentOrder);
  }

  function normalizeOrigin(origin) {
    if (origin == null) return { transformOrigin: "50% 50%" };
    if (Array.isArray(origin)) return { svgOrigin: origin[0] + " " + origin[1] };
    var words = { center: "50% 50%", left: "0% 50%", right: "100% 50%", top: "50% 0%", bottom: "50% 100%",
      topleft: "0% 0%", topright: "100% 0%", bottomleft: "0% 100%", bottomright: "100% 100%" };
    var key = String(origin).replace(/[\s_-]/g, "").toLowerCase();
    return { transformOrigin: words[key] || String(origin) };
  }

  /* ---------------------------------------------------- SVG text -> per-char */

  var segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

  function graphemes(text) {
    if (segmenter) return Array.from(segmenter.segment(text), function (s) { return s.segment; });
    return text.match(/\P{M}\p{M}*|\p{M}+/gu) || [];
  }

  // Wrap every visible character of an SVG <text> in its own <tspan>; returns the tspans.
  function splitSvgText(textEl) {
    if (textEl.__explainChars) return textEl.__explainChars;
    var chars = [];
    var walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node, index) {
      var raw = node.data.replace(/\s+/g, " ");
      if (index === 0) raw = raw.replace(/^ /, "");
      if (index === nodes.length - 1) raw = raw.replace(/ $/, "");
      if (!raw) { node.parentNode.removeChild(node); return; }
      var frag = document.createDocumentFragment();
      graphemes(raw).forEach(function (g) {
        if (g === " ") {
          frag.appendChild(document.createTextNode(" "));
        } else {
          var span = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
          span.setAttribute("data-em-char", "");
          // the layout audit reads this flag on the text block itself, so the characters carry their text's flag
          if (textEl.hasAttribute("data-layout-allow-overlap")) span.setAttribute("data-layout-allow-overlap", "");
          span.textContent = g;
          frag.appendChild(span);
          chars.push(span);
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
    textEl.__explainChars = chars;
    return chars;
  }

  function splitHtmlText(el) {
    if (el.__explainChars) return el.__explainChars;
    var split = SplitText.create(el, { type: "chars", charsClass: "em-char" });
    el.__explainChars = split.chars.slice();
    return el.__explainChars;
  }

  /* -------------------------------------------------------------- kit state */

  function createState(cfg) {
    var stage = document.getElementById(STAGE_ID);
    if (!stage || tagOf(stage) !== "svg") {
      fail('the page has no <svg id="stage">. Put your drawing inside the STAGE region of index.html.');
    }
    if (!stage.getAttribute("viewBox")) stage.setAttribute("viewBox", "0 0 " + cfg.width + " " + cfg.height);
    var vb = stage.getAttribute("viewBox").trim().split(/[\s,]+/).map(Number);
    if (vb.length !== 4 || vb.some(function (n) { return !isFinite(n); }) || !(vb[2] > 0) || !(vb[3] > 0)) {
      fail('<svg id="stage"> has viewBox="' + stage.getAttribute("viewBox") + '". Use four numbers, like "0 0 ' + cfg.width + " " + cfg.height + '".');
    }
    return {
      stage: stage,
      initialViewBox: vb.slice(),
      cam: { x: vb[0], y: vb[1], w: vb[2], h: vb[3] },
      elements: new WeakMap()
    };
  }

  // morph replaces rect, circle and polygon elements by paths; calls recorded earlier still hold the old node.
  function live(kit, el) {
    while (kit._swap.has(el)) el = kit._swap.get(el);
    return el;
  }

  function elState(state, el) {
    var s = state.elements.get(el);
    if (!s) {
      var cs = getComputedStyle(el);
      s = { base: num(cs.opacity, 1), fillOpacity: num(cs.fillOpacity, 1), gated: false, introduced: false, touched: false };
      state.elements.set(el, s);
    }
    return s;
  }

  /* ------------------------------------------------------------ the builder */

  function createBuilder(kit, beat) {
    var cfg = kit._cfg;
    var ops = [];
    var cursor = 0;
    var prevStart = 0;
    var pending = null;

    function place(span) {
      var local;
      if (pending == null) {
        local = cursor;
      } else if (typeof pending === "number") {
        local = pending;
      } else if (pending === "<") {
        local = prevStart;
      } else if (pending === ">") {
        local = cursor;
      } else {
        var m = /^(<|>)?\s*([+-])=\s*([\d.]+)$/.exec(String(pending));
        if (!m) fail('beat "' + beat.id + '": .at(' + JSON.stringify(pending) + ') is not a position. Use seconds, "<", ">", "+=0.3" or "-=0.2".');
        var anchor = m[1] === "<" ? prevStart : cursor;
        local = anchor + (m[2] === "-" ? -1 : 1) * parseFloat(m[3]);
      }
      pending = null;
      if (local < 0) local = 0;
      prevStart = local;
      cursor = local + span;
      return local;
    }

    function addOp(prim, where, built) {
      var local = place(built.span);
      ops.push({
        prim: prim,
        beat: beat,
        where: where,
        local: local,
        abs: beat.start + local,
        span: built.span,
        run: built.run,
        targets: built.targets || [],
        // a primitive may learn that it is an entrance while it runs (count), so read it from the built object
        get entrance() { return !!built.entrance; }
      });
    }

    function options(prim, where, opts) {
      opts = opts || {};
      if (typeof opts !== "object") fail(where + ": options must be an object like { dur: 1 }, got " + typeof opts + ".");
      Object.keys(opts).forEach(function (key) {
        if (OPTION_KEYS[prim].indexOf(key) === -1) {
          warn(where + ": unknown option \"" + key + "\" ignored. Valid options: " + OPTION_KEYS[prim].join(", ") + ".");
        }
      });
      var dur = opts.dur != null ? opts.dur : opts.duration;
      if (dur == null) dur = cfg.durations[prim];
      dur = num(dur, NaN);
      if (!(dur > 0)) fail(where + ": dur must be a number of seconds greater than 0.");
      var role = easeRole(prim, opts);
      return { dur: dur, ease: opts.ease || (role && cfg.eases[role]) || cfg.ease, o: opts };
    }

    var api = {
      id: beat.id,
      start: beat.start,
      end: beat.end,
      dur: beat.dur,
      at: function (position) {
        pending = position;
        return proxy;
      }
    };

    PRIMITIVES.forEach(function (prim) {
      api[prim] = function () {
        var args = Array.prototype.slice.call(arguments);
        var label = prim === "camera" ? "" : describe(args[0]);
        var where = 'beat "' + beat.id + '" ' + prim + "(" + label + ")";
        var built = prims[prim](kit, beat, where, options, args);
        addOp(prim, where, built);
        return proxy;
      };
    });

    var proxy = typeof Proxy === "function" ? new Proxy(api, {
      get: function (target, prop) {
        if (prop in target || typeof prop !== "string") return target[prop];
        return function () {
          fail('beat "' + beat.id + '": b.' + prop + "() is not a primitive. The only primitives are " + PRIMITIVES.join(", ") + ".");
        };
      }
    }) : api;

    return { api: proxy, ops: ops };
  }

  /* ------------------------------------------------------------- primitives */

  var prims = {};

  // Stage the entrance of an element: invisible from time 0 until `at`.
  // With show:false the caller reveals the element itself (fade, draw ramp).
  function enter(kit, tl, el, at, where, show) {
    var st = elState(kit._state, el);
    if (!st.gated && !st.touched && !st.introduced) {
      st.gated = true;
      tl.set(el, { opacity: 0 }, 0);
    } else if (st.touched && !st.introduced) {
      warn(where + ": " + describe(el) + " was already animated before this entrance, so it is on screen from the start of the video. Introduce it first or drop the earlier call.");
    }
    st.introduced = true;
    if (show !== false) tl.set(el, { opacity: st.base }, at);
    return st;
  }

  function touch(kit, el) {
    var st = elState(kit._state, el);
    if (!st.introduced) st.touched = true;
    return st;
  }

  // Is the element, a group around it, or something inside it already on screen at this point of the build?
  function onScreen(kit, el) {
    function seen(node) {
      var st = kit._state.elements.get(node);
      return !!st && (st.introduced || st.touched);
    }
    if (seen(el)) return true;
    for (var p = el.parentNode; p && p.nodeType === 1; p = p.parentNode) if (seen(p)) return true;
    var inner = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (var i = 0; i < inner.length; i++) if (seen(inner[i])) return true;
    return false;
  }

  // ---- draw ---------------------------------------------------------------

  prims.draw = function (kit, beat, where, options, args) {
    var o = options("draw", where, args[1]);
    var targets = resolve(args[0], where);
    var leaves = collectLeaves(targets);
    if (!leaves.length) fail(where + ": nothing drawable inside " + describe(args[0]) + ". draw needs shapes (path, line, rect, circle, ellipse, polyline, polygon) or a group of them.");
    var dur = o.dur;
    var n = leaves.length;
    var stagger = o.o.stagger != null ? num(o.o.stagger, 0) : n > 1 ? Math.min(0.15, dur / (n * 1.5)) : 0;
    var out = !!o.o.out;
    var from = o.o.from || "start";
    if (["start", "center", "end"].indexOf(from) === -1) fail(where + ': from must be "start", "center" or "end".');
    var span = dur + stagger * (n - 1);
    var edge = from === "center" ? "50% 50%" : from === "end" ? "100% 100%" : "0% 0%";
    return {
      span: span,
      targets: leaves,
      entrance: !out,
      run: function (tl, abs) {
        leaves.forEach(function (el0, i) {
          var el = live(kit, el0);
          var at = abs + i * stagger;
          var tag = tagOf(el);
          var st;
          if (!SHAPE[tag] || !hasStroke(el)) {
            // text, images, and fill-only shapes cannot be stroked: they fade with the draw
            if (SHAPE[tag]) warn(where + ": " + describe(el) + " has no stroke, so it fades instead of drawing. Give it a stroke, or use grow or fade.");
            var fd = Math.min(dur * 0.6, 0.5);
            if (out) {
              touch(kit, el);
              tl.to(el, { opacity: 0, duration: fd, ease: "power1.out" }, at);
            } else {
              st = enter(kit, tl, el, at, where, false);
              tl.fromTo(el, { opacity: 0 }, { opacity: st.base, duration: fd, ease: "power1.out", immediateRender: false }, at);
            }
            return;
          }
          if (out) {
            touch(kit, el);
            tl.fromTo(el, { drawSVG: "0% 100%" }, { drawSVG: edge, duration: dur, ease: o.ease, immediateRender: false }, at);
            tl.set(el, { opacity: 0 }, at + dur);
            return;
          }
          var first = !elState(kit._state, el).gated && !elState(kit._state, el).touched && !elState(kit._state, el).introduced;
          st = enter(kit, tl, el, at, where, false);
          // the opacity ramp makes the entrance countable by the motion audit; the stroke itself starts at zero length
          tl.fromTo(el, { opacity: 0 }, { opacity: st.base, duration: Math.min(0.15, dur * 0.2), ease: "none", immediateRender: false }, at);
          tl.fromTo(el, { drawSVG: edge }, { drawSVG: "0% 100%", duration: dur, ease: o.ease, immediateRender: false }, at);
          if (hasFill(el)) {
            // like manim's Create: the fill arrives while the stroke finishes
            if (first) tl.set(el, { fillOpacity: 0 }, 0);
            tl.set(el, { fillOpacity: 0 }, at);
            tl.to(el, { fillOpacity: st.fillOpacity, duration: dur * 0.5, ease: "power1.out" }, at + dur * 0.5);
          }
        });
      }
    };
  };

  // ---- write --------------------------------------------------------------

  prims.write = function (kit, beat, where, options, args) {
    var o = options("write", where, args[1]);
    var targets = resolve(args[0], where);
    var texts = [];
    targets.forEach(function (el) {
      if (isSvg(el)) {
        if (tagOf(el) === "text") texts.push(el);
        else Array.prototype.forEach.call(el.querySelectorAll("text"), function (t) { texts.push(t); });
      } else {
        texts.push(el);
      }
    });
    if (!texts.length) fail(where + ": " + describe(args[0]) + " holds no text. write needs an SVG <text> element, a group containing one, or an HTML element with text.");
    texts.sort(inDocumentOrder);
    var chars = [];
    texts.forEach(function (el) {
      var parts = isSvg(el) ? splitSvgText(el) : splitHtmlText(el);
      Array.prototype.push.apply(chars, parts);
    });
    if (!chars.length) fail(where + ": " + describe(args[0]) + " has no visible characters to write.");
    var n = chars.length;
    var charDur = num(o.o.charDur, Math.min(0.3, o.dur * 0.5));
    var per = o.o.stagger != null ? num(o.o.stagger, 0) : n > 1 ? Math.min(0.08, Math.max(0.004, (o.dur - charDur) / (n - 1))) : 0;
    var span = per * (n - 1) + charDur;
    return {
      span: span,
      targets: texts,
      entrance: true,
      run: function (tl, abs) {
        texts.forEach(function (el) { enter(kit, tl, el, abs, where); });
        var key = "__explainCharsHidden";
        chars.forEach(function (c) {
          if (!c[key]) { c[key] = true; tl.set(c, { opacity: 0 }, 0); }
        });
        tl.set(chars, { opacity: 0 }, abs);
        tl.to(chars, { opacity: 1, duration: charDur, ease: "power1.out", stagger: per }, abs);
      }
    };
  };

  // ---- morph --------------------------------------------------------------

  function toPath(kit, el) {
    el = live(kit, el);
    if (tagOf(el) === "path") return el;
    if (!SHAPE[tagOf(el)]) fail("morph needs shapes (path, rect, circle, ellipse, line, polyline, polygon); got " + describe(el) + ".");
    var made = MorphSVGPlugin.convertToPath(el);
    var path = made && made[0] ? made[0] : el;
    if (path !== el) kit._swap.set(el, path);
    return path;
  }

  prims.morph = function (kit, beat, where, options, args) {
    var o = options("morph", where, args[2]);
    if (args.length < 2) fail(where + ": morph needs two selectors: b.morph(\"#from\", \"#to\").");
    var fromList = resolve(args[0], where).map(function (el) { return toPath(kit, el); });
    var toList = resolve(args[1], where).map(function (el) { return toPath(kit, el); });
    if (toList.length !== 1 && toList.length !== fromList.length) {
      fail(where + ": " + fromList.length + " source shape(s) and " + toList.length + " target shape(s). Use one target, or the same number of each.");
    }
    var styled = o.o.style !== false;
    return {
      span: o.dur,
      targets: fromList,
      run: function (tl, abs) {
        toList.forEach(function (el) {
          var st = elState(kit._state, el);
          if (!st.gated) { st.gated = true; tl.set(el, { opacity: 0 }, 0); }
        });
        fromList.forEach(function (el, i) {
          var to = toList.length === 1 ? toList[0] : toList[i];
          touch(kit, el);
          var vars = {
            morphSVG: { shape: to, shapeIndex: o.o.shapeIndex != null ? o.o.shapeIndex : "auto", type: o.o.type || "linear" },
            duration: o.dur,
            ease: o.ease
          };
          if (styled) {
            var b = getComputedStyle(to);
            var fa = cssColor(el, "fill");
            var fb = cssColor(to, "fill");
            var sa = cssColor(el, "stroke");
            var sb = cssColor(to, "stroke");
            if (fa && fb) vars.fill = b.fill;
            else if (fa && !fb) vars.fillOpacity = 0;
            else if (!fa && fb) {
              tl.set(el, { fill: b.fill, fillOpacity: 0 }, abs);
              vars.fillOpacity = num(b.fillOpacity, 1);
            }
            if (sa && sb) { vars.stroke = b.stroke; vars.strokeWidth = num(b.strokeWidth, 1); }
            else if (sa && !sb) vars.strokeOpacity = 0;
            else if (!sa && sb) {
              tl.set(el, { stroke: b.stroke, strokeWidth: num(b.strokeWidth, 1), strokeOpacity: 0 }, abs);
              vars.strokeOpacity = num(b.strokeOpacity, 1);
            }
          }
          tl.to(el, vars, abs);
        });
      }
    };
  };

  // ---- move ---------------------------------------------------------------

  function xy(value, where, name) {
    if (Array.isArray(value)) return { x: num(value[0], 0), y: num(value[1], 0) };
    if (value && typeof value === "object") return { x: num(value.x, 0), y: num(value.y, 0) };
    fail(where + ": " + name + " must be [x, y] or { x, y }.");
  }

  prims.move = function (kit, beat, where, options, args) {
    var o = options("move", where, args[1]);
    var targets = resolve(args[0], where);
    var opts = o.o;
    var modes = ["along", "to", "by"].filter(function (k) { return opts[k] != null; });
    if (modes.length !== 1) fail(where + ": give exactly one of along (a path selector), to ([x, y] centre), or by ([dx, dy]).");
    var mode = modes[0];
    var pathEl = mode === "along" ? resolve(opts.along, where + " along")[0] : null;
    if (pathEl && tagOf(pathEl) !== "path" && !SHAPE[tagOf(pathEl)]) fail(where + ": along must point at a path or shape, got " + describe(opts.along) + ".");
    var dest = mode === "to" ? xy(opts.to, where, "to") : mode === "by" ? xy(opts.by, where, "by") : null;
    if (mode === "to") {
      targets.forEach(function (el) {
        if (!isSvg(el)) fail(where + ": move to works on SVG elements. Use by: [dx, dy] for HTML elements.");
      });
    }
    return {
      span: o.dur,
      targets: targets,
      run: function (tl, abs) {
        targets.forEach(function (el0) {
          var el = live(kit, el0);
          touch(kit, el);
          if (mode === "along") {
            tl.to(el, {
              motionPath: {
                path: pathEl,
                align: pathEl,
                alignOrigin: opts.align || [0.5, 0.5],
                autoRotate: !!opts.rotate,
                start: opts.start != null ? opts.start : 0,
                end: opts.end != null ? opts.end : 1
              },
              duration: o.dur,
              ease: o.ease
            }, abs);
          } else if (mode === "by") {
            tl.to(el, { x: "+=" + dest.x, y: "+=" + dest.y, duration: o.dur, ease: o.ease }, abs);
          } else {
            var bb = el.getBBox();
            tl.to(el, { x: dest.x - (bb.x + bb.width / 2), y: dest.y - (bb.y + bb.height / 2), duration: o.dur, ease: o.ease }, abs);
          }
        });
      }
    };
  };

  // ---- camera -------------------------------------------------------------

  // Grow a box to the stage's own aspect (read from its viewBox: 16:9 landscape, 9:16 portrait),
  // keeping its centre, so the camera never shows a different shape than the frame.
  function fitAspect(box, ratio) {
    var w = box.w;
    var h = box.h;
    if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
    return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w: w, h: h };
  }

  // The part of the frame the camera may fill, as fractions of the frame: the design's safe zone. With burned
  // captions, a band that cuts into the bottom of the safe zone shortens it. null without a usable layout.
  function safeFractions(cfg) {
    var safe = boxOf(cfg.layout && cfg.layout.safe);
    if (!safe) return null;
    var band = cfg.captions.burn ? boxOf(cfg.layout.captions) : null;
    if (band && band[1] > (safe[1] + safe[3]) / 2 && band[1] < safe[3]) safe = [safe[0], safe[1], safe[2], band[1]];
    var f = { x0: safe[0] / cfg.width, x1: safe[2] / cfg.width, y0: safe[1] / cfg.height, y1: safe[3] / cfg.height };
    return f.x1 - f.x0 > 0.1 && f.y1 - f.y0 > 0.1 ? f : null;
  }

  // The view (a box with the stage's aspect) in which `box` fills the safe zone on screen as far as its shape
  // allows and sits at the centre of it. The rest of the stage lands wherever that puts it.
  function fitToSafe(box, ratio, f) {
    var w = Math.max(box.w / (f.x1 - f.x0), ratio * box.h / (f.y1 - f.y0));
    var h = w / ratio;
    return { x: box.x + box.w / 2 - w * (f.x0 + f.x1) / 2, y: box.y + box.h / 2 - h * (f.y0 + f.y1) / 2, w: w, h: h };
  }

  function stageBox(kit, el, where) {
    // Resting box of an element in stage coordinates, measured with the camera at its initial framing.
    var svg = kit._state.stage;
    var bb;
    try { bb = el.getBBox(); } catch (e) { fail(where + ": cannot measure " + describe(el) + "."); }
    var parentCtm = (el.parentNode && el.parentNode.getScreenCTM && el.parentNode.getScreenCTM()) || svg.getScreenCTM();
    var inv = svg.getScreenCTM().inverse();
    var m = inv.multiply(parentCtm);
    var pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(function (p) {
      return { x: m.a * p[0] + m.c * p[1] + m.e, y: m.b * p[0] + m.d * p[1] + m.f };
    });
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    return { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
  }

  prims.camera = function (kit, beat, where, options, args) {
    var o = options("camera", where, args[0]);
    var opts = o.o;
    var iv0 = kit._state.initialViewBox;
    var aspect = iv0[2] / iv0[3];
    var focusBox = null;
    if (opts.focus != null) {
      var els = resolve(opts.focus, where + " focus");
      var boxes = els.map(function (el) { return stageBox(kit, el, where); });
      var x0 = Math.min.apply(null, boxes.map(function (b) { return b.x; }));
      var y0 = Math.min.apply(null, boxes.map(function (b) { return b.y; }));
      var x1 = Math.max.apply(null, boxes.map(function (b) { return b.x + b.w; }));
      var y1 = Math.max.apply(null, boxes.map(function (b) { return b.y + b.h; }));
      var pad = num(opts.pad, 160);
      focusBox = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
    }
    var explicit = ["x", "y", "w", "h"].filter(function (k) { return opts[k] != null; });
    if (explicit.length && explicit.length !== 4) fail(where + ": give all of x, y, w, h (the stage is " + iv0[2] + "x" + iv0[3] + "), or use focus, zoom or reset.");
    if (!focusBox && !explicit.length && opts.zoom == null && !opts.reset) {
      fail(where + ": camera needs one of { x, y, w, h }, { focus: \"#selector\" }, { zoom: 1.5 } or { reset: true }.");
    }
    if (opts.zoom != null && !(num(opts.zoom, 0) > 0)) fail(where + ": zoom must be a number greater than 0 (1.5 zooms in, 0.8 zooms out).");
    var safe = safeFractions(kit._cfg);
    return {
      span: o.dur,
      targets: [],
      run: function (tl, abs) {
        var cur = kit._state.cam;
        var next;
        if (opts.reset) {
          var iv = kit._state.initialViewBox;
          next = { x: iv[0], y: iv[1], w: iv[2], h: iv[3] };
        } else if (focusBox) {
          // the focus box goes inside the safe zone on screen, not into the whole frame
          next = safe ? fitToSafe(focusBox, aspect, safe) : fitAspect(focusBox, aspect);
        } else if (explicit.length) {
          next = fitAspect({ x: num(opts.x, 0), y: num(opts.y, 0), w: num(opts.w, iv0[2]), h: num(opts.h, iv0[3]) }, aspect);
        } else {
          var z = num(opts.zoom, 1);
          var cx = opts.cx != null ? num(opts.cx, 0) : cur.x + cur.w / 2;
          var cy = opts.cy != null ? num(opts.cy, 0) : cur.y + cur.h / 2;
          var w = iv0[2] / z;
          var h = iv0[3] / z;
          next = { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
          // a named centre goes to the middle of the safe zone on screen; a centre left out keeps the view where it is
          if (safe && opts.cx != null) next.x = cx - w * (safe.x0 + safe.x1) / 2;
          if (safe && opts.cy != null) next.y = cy - h * (safe.y0 + safe.y1) / 2;
        }
        var from = cur.x + " " + cur.y + " " + cur.w + " " + cur.h;
        var to = round(next.x) + " " + round(next.y) + " " + round(next.w) + " " + round(next.h);
        tl.fromTo(kit._state.stage, { attr: { viewBox: from } }, { attr: { viewBox: to }, duration: o.dur, ease: o.ease, immediateRender: false }, abs);
        kit._state.cam = { x: round(next.x), y: round(next.y), w: round(next.w), h: round(next.h) };
      }
    };
  };

  // ---- indicate -----------------------------------------------------------

  prims.indicate = function (kit, beat, where, options, args) {
    var o = options("indicate", where, args[1]);
    var targets = resolve(args[0], where);
    var scale = num(o.o.scale, 1.2);
    var cfg = kit._cfg;
    var color = o.o.color || cfg.colors.yellow || "#FFFF00";
    if (color.charAt(0) !== "#" && /^[a-z-]+$/i.test(color) && cfg.colors[color]) color = cfg.colors[color];
    return {
      span: o.dur,
      targets: targets,
      run: function (tl, abs) {
        targets.forEach(function (el0) {
          var el = live(kit, el0);
          touch(kit, el);
          var vars = { scale: "*=" + scale, transformOrigin: "50% 50%", duration: o.dur / 2, ease: o.ease, yoyo: true, repeat: 1 };
          // flash the paint of the element, or of the shapes and text inside a group
          var paint = [el];
          if (!SHAPE[tagOf(el)] && tagOf(el) !== "text") paint = collectLeaves([el]);
          paint.forEach(function (p) {
            var colors = {};
            if (hasFill(p) && (SHAPE[tagOf(p)] || tagOf(p) === "text")) colors.fill = color;
            if (hasStroke(p)) colors.stroke = color;
            if (p === el) Object.assign(vars, colors);
            else if (Object.keys(colors).length) {
              tl.to(p, Object.assign({ duration: o.dur / 2, ease: o.ease, yoyo: true, repeat: 1 }, colors), abs);
            }
          });
          tl.to(el, vars, abs);
        });
      }
    };
  };

  // ---- count --------------------------------------------------------------
  // A counter is a pure function of the playhead. Each b.count adds a segment { at, dur, from, to, ease,
  // format } to its element; one driver tween per element (see driveCounts) writes the text from those
  // segments and the timeline time. Nothing writes text while the beats are being authored, so the text
  // at any time is the same for every seek order: the first call's from before it starts, each segment's own
  // from at its own time, the last to afterwards.
  // The first count of an element that nothing else introduced also introduces it: hidden until its start,
  // then a short fade to its authored opacity. An element that is already on screen is left as it is.

  prims.count = function (kit, beat, where, options, args) {
    var o = options("count", where, args[1]);
    var targets = resolve(args[0], where);
    var opts = o.o;
    if (opts.to == null || !isFinite(Number(opts.to))) fail(where + ": count needs a numeric to, like b.count(\"#n\", { from: 0, to: 42 }).");
    var to = Number(opts.to);
    var explicitFrom = opts.from != null ? Number(opts.from) : null;
    if (explicitFrom != null && !isFinite(explicitFrom)) fail(where + ": from must be a number.");
    // the number the element holds in the page, read before anything can change it
    targets.forEach(function (el) {
      if (!kit._countOrigin.has(el)) {
        var text = el.textContent.trim();
        // plain: the text is a number written the way JavaScript writes it, so "7" and "0.5" are plain and
        // "1.000" (a thousand in many languages), "R$ 5" and "12,5" are not
        kit._countOrigin.set(el, { value: num(text, 0), text: text, plain: text === "" || String(Number(text)) === text });
      }
    });
    var prefix = opts.prefix || "";
    var suffix = opts.suffix || "";
    var built = {
      span: o.dur,
      targets: targets,
      entrance: false,
      run: function (tl, abs) {
        targets = targets.map(function (el) { return live(kit, el); });
        targets.forEach(function (el) {
          if (!onScreen(kit, el)) {
            var st = enter(kit, tl, el, abs, where, false);
            tl.fromTo(el, { opacity: 0 }, { opacity: st.base, duration: Math.min(0.2, o.dur * 0.3), ease: "power1.out", immediateRender: false }, abs);
            built.entrance = true;
          } else {
            touch(kit, el);
          }
          var segs = kit._counts.get(el);
          if (!segs) { segs = []; kit._counts.set(el, segs); }
          var origin = kit._countOrigin.get(el) || { value: num(el.textContent, 0), text: el.textContent, plain: true };
          if (explicitFrom == null && !segs.length && !origin.plain) {
            warn(where + ": from is omitted and the text of " + describe(el) + " is " + JSON.stringify(origin.text) + ", which is not a plain number, so the count starts at " + origin.value + ". Always pass from, and use prefix, suffix or locale for money and units.");
          }
          var from = explicitFrom != null ? explicitFrom : segs.length ? segs[segs.length - 1].to : origin.value;
          var decimals = opts.decimals != null ? Math.max(0, Math.floor(opts.decimals)) : Math.max(decimalsOf(from), decimalsOf(to));
          var nf = typeof Intl !== "undefined" ? new Intl.NumberFormat(opts.locale || kit._cfg.lang, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : null;
          var format = typeof opts.format === "function" ? opts.format : function (v) {
            return prefix + (nf ? nf.format(v) : v.toFixed(decimals)) + suffix;
          };
          segs.push({ at: abs, dur: o.dur, from: from, to: to, ease: gsap.parseEase(o.ease), format: format });
        });
      }
    };
    return built;
  };

  // The text of a counter at timeline time t, from its segments in time order.
  function countText(segs, t) {
    var seg = segs[0];
    for (var i = 0; i < segs.length; i++) if (segs[i].at <= t + 1e-9) seg = segs[i];
    if (t <= seg.at) return seg.format(seg.from);
    var p = (t - seg.at) / seg.dur;
    if (p >= 1) return seg.format(seg.to);
    return seg.format(seg.from + (seg.to - seg.from) * seg.ease(p));
  }

  // One driver per counted element: a linear tween over [0, last segment end] whose value is its own time,
  // so every render (any order, any jump) rewrites the text from that time alone.
  function driveCounts(kit, tl) {
    kit._counts.forEach(function (segs, el) {
      var last = 0;
      segs.forEach(function (seg) { last = Math.max(last, seg.at + seg.dur); });
      var apply = function (t) {
        var text = countText(segs, t);
        if (el.textContent !== text) el.textContent = text;
      };
      apply(0);
      var clock = { t: 0 };
      tl.fromTo(clock, { t: 0 }, { t: last, duration: last, ease: "none", immediateRender: false, onUpdate: function () { apply(clock.t); } }, 0);
    });
  }

  function decimalsOf(n) {
    var s = String(n);
    var i = s.indexOf(".");
    return i === -1 ? 0 : Math.min(6, s.length - i - 1);
  }

  // ---- grow ---------------------------------------------------------------

  prims.grow = function (kit, beat, where, options, args) {
    var o = options("grow", where, args[1]);
    var targets = resolve(args[0], where);
    var opts = o.o;
    var axis = opts.axis || "both";
    if (["both", "x", "y"].indexOf(axis) === -1) fail(where + ': axis must be "both", "x" or "y".');
    var origin = normalizeOrigin(opts.origin);
    var out = !!opts.out;
    var stagger = num(opts.stagger, 0);
    var from = num(opts.from, 0);
    return {
      span: o.dur + stagger * (targets.length - 1),
      targets: targets,
      entrance: !out,
      run: function (tl, abs) {
        targets.forEach(function (el0, i) {
          var el = live(kit, el0);
          var at = abs + i * stagger;
          var bx = num(gsap.getProperty(el, "scaleX"), 1);
          var by = num(gsap.getProperty(el, "scaleY"), 1);
          var full = {};
          var small = {};
          if (axis !== "y") { full.scaleX = bx; small.scaleX = bx * from; }
          if (axis !== "x") { full.scaleY = by; small.scaleY = by * from; }
          if (out) {
            touch(kit, el);
            tl.fromTo(el, Object.assign({}, full, origin), Object.assign({ duration: o.dur, ease: o.ease, immediateRender: false }, small, origin), at);
            tl.set(el, { opacity: 0 }, at + o.dur);
            return;
          }
          enter(kit, tl, el, at, where);
          tl.fromTo(el, Object.assign({}, small, origin), Object.assign({ duration: o.dur, ease: o.ease, immediateRender: false }, full, origin), at);
        });
      }
    };
  };

  // ---- fade ---------------------------------------------------------------

  prims.fade = function (kit, beat, where, options, args) {
    var o = options("fade", where, args[1]);
    var targets = resolve(args[0], where);
    var opts = o.o;
    var out = !!opts.out;
    var stagger = num(opts.stagger, 0);
    var shift = opts.shift != null ? xy(opts.shift, where, "shift") : null;
    return {
      span: o.dur + stagger * (targets.length - 1),
      targets: targets,
      entrance: !out && opts.to == null,
      run: function (tl, abs) {
        targets.forEach(function (el0, i) {
          var el = live(kit, el0);
          var at = abs + i * stagger;
          var st = elState(kit._state, el);
          var shown = onScreen(kit, el);
          if (out || (opts.to != null && shown)) {
            // leave: fade out, or dim an element that is already on screen
            touch(kit, el);
            var vars = { opacity: opts.to != null ? num(opts.to, 0) : 0, duration: o.dur, ease: o.ease };
            if (shift) { vars.x = "+=" + shift.x; vars.y = "+=" + shift.y; }
            tl.to(el, vars, at);
          } else {
            // enter: from invisible (or opts.from) up to the authored opacity (or opts.to)
            enter(kit, tl, el, at, where, false);
            var from = { opacity: num(opts.from, 0) };
            var to = { opacity: opts.to != null ? num(opts.to, 1) : st.base, duration: o.dur, ease: o.ease, immediateRender: false };
            if (shift) {
              var x0 = num(gsap.getProperty(el, "x"), 0);
              var y0 = num(gsap.getProperty(el, "y"), 0);
              from.x = x0 + shift.x; from.y = y0 + shift.y;
              to.x = x0; to.y = y0;
            }
            tl.fromTo(el, from, to, at);
          }
        });
      }
    };
  };

  /* ---------------------------------------------------------------- captions */
  // Burned captions are a layer of their own: <div id="captions">, outside the stage, filled from
  // window.EXPLAIN when captions.burn is true. Each beat's narration is cut into chunks of at most
  // captions.maxWords words at natural breaks. A chunk shows for the share of [beat.start, beat.end]
  // that its words make up, with short opacity fades. Every opacity is an explicit fromTo tween, so the
  // layer is a function of the playhead time like everything else. It has no box behind it: legibility
  // comes from a text shadow in the background colour.

  var wordSegmenters = {};

  function wordSegmenter(lang) {
    if (typeof Intl === "undefined" || !Intl.Segmenter) return null;
    if (!(lang in wordSegmenters)) {
      try { wordSegmenters[lang] = new Intl.Segmenter(lang, { granularity: "word" }); }
      catch (e) { wordSegmenters[lang] = new Intl.Segmenter(undefined, { granularity: "word" }); }
    }
    return wordSegmenters[lang];
  }

  // The words of a text as { start, end } character ranges, punctuation excluded.
  function wordRanges(text, lang) {
    var out = [];
    var seg = wordSegmenter(lang);
    if (seg) {
      Array.from(seg.segment(text)).forEach(function (part) {
        if (part.isWordLike) out.push({ start: part.index, end: part.index + part.segment.length });
      });
    } else {
      var re = /\S+/g;
      var m;
      while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length });
    }
    return out;
  }

  // Cut one narration into chunks of at most maxWords words. Minimise a cost: sizes close to even,
  // no one-word chunk, and a break after punctuation is cheaper than a break inside a phrase.
  function captionChunks(text, lang, maxWords) {
    text = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    if (!text) return [];
    var words = wordRanges(text, lang);
    var n = words.length;
    if (!n) return [{ text: text, words: 1 }];
    function breakCost(i) { // cost of cutting between word i and word i + 1
      var gap = text.slice(Math.max(words[i].start, words[i].end - 1), words[i + 1].start);
      if (/[.!?\u2026\u3002\uff01\uff1f]/.test(gap)) return 0;
      if (/[,;:\u2014\u2013\u3001\uff0c\uff1b\uff1a]/.test(gap)) return 0.4;
      return 2.5;
    }
    var ideal = n / Math.ceil(n / maxWords);
    var best = [0];
    var prev = [0];
    for (var j = 1; j <= n; j++) {
      best[j] = Infinity;
      for (var i = Math.max(0, j - maxWords); i < j; i++) {
        var len = j - i;
        var cost = best[i] + Math.pow(len - ideal, 2) + (len === 1 && n > 1 ? 4 : 0) + (i > 0 ? breakCost(i - 1) : 0);
        if (cost < best[j]) { best[j] = cost; prev[j] = i; }
      }
    }
    var cuts = [];
    for (var at = n; at > 0; at = prev[at]) cuts.unshift(at);
    var chunks = [];
    var from = 0;
    var startIdx = 0;
    cuts.forEach(function (to) {
      var endIdx = text.length;
      if (to < n) {
        // trailing punctuation stays with the chunk it follows, an opening quote moves on
        var gap = text.slice(words[to - 1].end, words[to].start);
        var ws = gap.search(/\s/);
        endIdx = words[to - 1].end + (ws === -1 ? gap.length : ws);
      }
      chunks.push({ text: text.slice(startIdx, endIdx).trim(), words: to - from });
      from = to;
      startIdx = endIdx;
    });
    return chunks;
  }

  function prepareCaptions(kit) {
    var cfg = kit._cfg;
    if (!cfg.captions.burn) return null;
    var root = document.querySelector("[data-composition-id]") || document.body;
    var host = document.getElementById("captions");
    if (!host) {
      warn('captions.burn is true but the page has no <div id="captions">. Creating one; add it to index.html, outside the STAGE region.');
      host = document.createElement("div");
      host.id = "captions";
      root.appendChild(host);
    }
    var box = cfg.layout && cfg.layout.captions;
    if (!(Array.isArray(box) && box.length === 4 && box.every(function (n) { return isFinite(n); }))) {
      box = [Math.round(cfg.width / 12), Math.round(cfg.height * 0.8333), Math.round(cfg.width * 11 / 12), Math.round(cfg.height * 0.9537)];
    }
    var scale = (root.clientWidth || cfg.width) / cfg.width; // CSS pixels per stage unit
    host.textContent = "";
    host.setAttribute("aria-hidden", "true");
    var hs = host.style;
    hs.position = "absolute";
    hs.left = round(box[0] * scale, 2) + "px";
    hs.top = round(box[1] * scale, 2) + "px";
    hs.width = round((box[2] - box[0]) * scale, 2) + "px";
    hs.height = round((box[3] - box[1]) * scale, 2) + "px";
    hs.margin = "0";
    hs.padding = "0";
    hs.pointerEvents = "none";
    hs.zIndex = "5";
    var backing = "var(--em-bg, #000)";
    var shadow = ["0.04em 0.04em 0 ", "-0.04em 0.04em 0 ", "0.04em -0.04em 0 ", "-0.04em -0.04em 0 ", "0 0 0.12em ", "0 0.03em 0.25em "]
      .map(function (part) { return part + backing; }).join(", ");
    var chunks = [];
    cfg.beats.forEach(function (beat) {
      var parts = captionChunks(beat.narration, cfg.lang, cfg.captions.maxWords);
      var total = parts.reduce(function (sum, c) { return sum + c.words; }, 0);
      var done = 0;
      parts.forEach(function (part, index) {
        var el = document.createElement("div");
        el.className = "em-cap";
        el.setAttribute("data-beat", beat.id);
        el.textContent = part.text;
        var st = el.style;
        st.position = "absolute";
        st.left = "0";
        st.right = "0";
        st.top = "0";
        st.bottom = "0";
        st.display = "flex";
        st.alignItems = "center";
        st.justifyContent = "center";
        st.textAlign = "center";
        st.opacity = "0";
        st.color = "var(--em-text, #fff)";
        st.fontFamily = "var(--em-font-body)";
        st.fontWeight = "var(--em-weight-body, 400)";
        st.lineHeight = "1.15";
        st.overflowWrap = "anywhere";
        st.setProperty("text-wrap", "balance"); // even lines; ignored by engines without it
        st.textShadow = shadow;
        host.appendChild(el);
        var from = beat.start + beat.dur * (done / total);
        done += part.words;
        var to = index === parts.length - 1 ? beat.end : beat.start + beat.dur * (done / total);
        chunks.push({ el: el, beat: beat.id, start: from, end: to });
      });
    });
    return { host: host, box: box, scale: scale, chunks: chunks };
  }

  // Needs the fonts: choose the largest size (down to a floor) at which every chunk fits the band.
  function fitCaptions(kit, cap) {
    var cfg = kit._cfg;
    var portrait = cfg.orientation === "portrait";
    var size = portrait ? 64 : 52;
    var floor = portrait ? 56 : 44;
    var bandH = (cap.box[3] - cap.box[1]) * cap.scale;
    var range = document.createRange();
    var worst;
    for (;;) {
      worst = 0;
      cap.chunks.forEach(function (c) {
        c.el.style.fontSize = round(size * cap.scale, 2) + "px";
        range.selectNodeContents(c.el);
        worst = Math.max(worst, range.getBoundingClientRect().height);
      });
      if (worst <= bandH + 0.5 || size <= floor) break;
      size -= 2;
    }
    if (worst > bandH + 0.5) {
      warn("a caption needs " + round(worst, 0) + "px of height in a " + round(bandH, 0) + "px band at " + size + " units. Shorten that beat's narration or lower captions.maxWords.");
    }
    cap.size = size;
  }

  function animateCaptions(tl, cap) {
    cap.chunks.forEach(function (c) {
      var share = c.end - c.start;
      var fin = Math.min(CAPTION_FADE_IN, share * 0.3);
      var fout = Math.min(CAPTION_FADE_OUT, share * 0.25);
      tl.fromTo(c.el, { opacity: 0 }, { opacity: 1, duration: fin, ease: "power1.out", immediateRender: false }, c.start);
      tl.fromTo(c.el, { opacity: 1 }, { opacity: 0, duration: fout, ease: "power1.in", immediateRender: false }, c.end - fout);
    });
  }

  /* ---------------------------------------------------------------- ambient */
  // motion.ambient "subtle" or "lively": one glow in --em-ambient (colors.ambient, else --em-muted) drifting
  // behind the stage for the whole video. It lives outside #stage, and voice limits keepsMoving to #stage
  // whenever it is on, so background life can never pass the Motion Gate for a still stage.
  function buildAmbient(kit, tl) {
    var cfg = kit._cfg;
    var level = AMBIENT[cfg.ambient];
    if (!level) return null;
    var root = document.querySelector("[data-composition-id]") || document.body;
    var el = document.getElementById("em-ambient");
    if (!el) {
      el = document.createElement("div");
      el.id = "em-ambient";
      root.insertBefore(el, root.firstChild);
    }
    el.setAttribute("aria-hidden", "true");
    var st = el.style;
    st.position = "absolute";
    st.left = "-20%";
    st.top = "-20%";
    st.width = "140%";
    st.height = "140%";
    st.pointerEvents = "none";
    st.zIndex = "0";
    st.opacity = String(level.opacity);
    st.background = "radial-gradient(closest-side at 50% 45%, var(--em-ambient, var(--em-muted, #888)) 0%, transparent 100%)";
    // Whole half-cycles that end exactly with the video, so the glow never stretches the timeline.
    var total = Math.max(cfg.total, tl.duration());
    if (!(total > 0)) return el;
    var cycles = Math.max(1, Math.round(total / level.period));
    tl.fromTo(el, { xPercent: -level.shift, yPercent: -level.shift / 2, scale: 1 }, {
      xPercent: level.shift, yPercent: level.shift / 2, scale: level.scale,
      duration: total / cycles, ease: "sine.inOut", yoyo: true, repeat: cycles - 1
    }, 0);
    return el;
  }

  /* ------------------------------------------------------------ stage audit */
  // The safe zone and the caption band are only a promise until something measures them. After the build the
  // kit seeks its own timeline every AUDIT_STEP seconds (and just before each beat ends, where the frames are
  // taken), finds where every visible shape, text and image of the stage lands on screen, and reports:
  //   - caption band: a box that overlaps the burned captions. An error (console.error, which HyperFrames
  //     counts as a runtime error, so `check` fails) when it lasts BAND_BLOCKING_SEC or more, a warning
  //     when it is shorter. Only when captions are burned.
  //   - safe zone: a box that leaves layout.safe by more than SAFE_TOLERANCE. A warning.
  // Boxes are measured on screen, so the camera counts. A box wholly outside the frame is not on screen and is
  // not reported. An element, or a group around it, with data-em-allow-outside is left out. The audit only
  // reads the page, then seeks the timeline back to 0, so it changes nothing a frame shows.

  function auditLeaves(stage) {
    var out = [];
    Array.prototype.forEach.call(stage.querySelectorAll("*"), function (el) {
      var tag = tagOf(el);
      if (!SHAPE[tag] && !LEAF[tag]) return;
      if (el.hasAttribute("data-em-char")) return; // the written characters count through their text
      if (el.closest("defs, clipPath, mask, marker, symbol, pattern")) return;
      var holder = el.closest("foreignObject");
      if (holder && holder !== el) return;
      if (el.closest("[data-em-allow-outside]")) return;
      out.push({ el: el, first: tag === "text" ? el.querySelector("[data-em-char]") : null, plain: tag === "text" || !SHAPE[tag] });
    });
    return out;
  }

  // Opacity of an element on screen: its own times that of every group up to the stage.
  function shownOpacity(el, stage, cache) {
    var o = 1;
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      var v = cache.get(n);
      if (v === undefined) {
        var cs = getComputedStyle(n);
        v = cs.display === "none" || cs.visibility === "hidden" ? 0 : num(cs.opacity, 1);
        cache.set(n, v);
      }
      o *= v;
      if (o <= AUDIT_MIN_OPACITY || n === stage) break;
    }
    return o;
  }

  // "#id", "#group > text:nth-of-type(2)" or "<tag>": enough to find the element in index.html.
  function auditName(el, stage) {
    if (el.id) return "#" + el.id;
    var tag = tagOf(el);
    var parent = el.parentNode;
    var index = 1;
    Array.prototype.forEach.call(parent ? parent.children : [], function (sib) {
      if (sib === el) return;
      if (tagOf(sib) === tag && sib.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) index++;
    });
    for (var p = parent; p && p !== stage && p.nodeType === 1; p = p.parentNode) {
      if (p.id) return "#" + p.id + " > " + tag + ":nth-of-type(" + index + ")";
    }
    return "<" + tag + ">";
  }

  function auditSpans(times, step) {
    var spans = [];
    times.forEach(function (t) {
      var last = spans[spans.length - 1];
      if (last && t - last[1] <= step * 1.6) last[1] = t;
      else spans.push([t, t]);
    });
    return spans;
  }

  function spanText(spans) {
    var shown = spans.slice(0, 2).map(function (s) {
      return s[0] === s[1] ? round(s[0], 2) + " s" : round(s[0], 2) + "-" + round(s[1], 2) + " s";
    });
    return shown.join(", ") + (spans.length > 2 ? " and " + (spans.length - 2) + " more" : "");
  }

  function auditStage(kit, tl) {
    var cfg = kit._cfg;
    var safe = boxOf(cfg.layout && cfg.layout.safe);
    var band = cfg.captions.burn ? boxOf(cfg.layout && cfg.layout.captions) : null;
    if (!safe && !band) return null;
    var stage = kit._state.stage;
    var root = document.querySelector("[data-composition-id]") || document.body;
    var leaves = auditLeaves(stage);
    var iv0 = kit._state.initialViewBox;
    var total = Math.max(cfg.total, tl.duration());
    var times = [];
    for (var t = 0; t <= total + 1e-9; t += AUDIT_STEP) times.push(round(t, 3));
    cfg.beats.forEach(function (b) { times.push(round(Math.max(0, b.end - 0.05), 3)); });
    times = times.sort(function (a, b) { return a - b; }).filter(function (t, i, all) { return i === 0 || t - all[i - 1] > 0.001; });

    var found = new Map(); // element -> { kind -> { times, depth, edges, zoom } }
    var viewBoxNow = function () {
      var vb = (stage.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
      return vb.length === 4 && vb[2] > 0 ? vb : iv0;
    };
    var note = function (el, kind, time, depth, edge, zoom) {
      var perEl = found.get(el);
      if (!perEl) { perEl = {}; found.set(el, perEl); }
      var rec = perEl[kind];
      if (!rec) rec = perEl[kind] = { times: [], depth: 0, edges: {}, zoom: zoom };
      rec.times.push(time);
      if (depth > rec.depth) { rec.depth = depth; rec.zoom = zoom; }
      if (edge) rec.edges[edge] = Math.max(rec.edges[edge] || 0, depth);
    };

    tl.seek(Math.min(0.01, tl.duration()), false); // the first render applies the time-0 state
    times.forEach(function (time) {
      tl.seek(time, false);
      var rr = root.getBoundingClientRect();
      if (!(rr.width > 0 && rr.height > 0)) return;
      var k = cfg.width / rr.width; // stage frame units per CSS pixel
      var vb = viewBoxNow();
      var perUnit = cfg.width / vb[2]; // frame units per stage unit
      var zoom = round(iv0[2] / vb[2], 2);
      var cache = new Map();
      leaves.forEach(function (leaf) {
        var el = leaf.el;
        var alpha = shownOpacity(el, stage, cache);
        if (alpha <= AUDIT_MIN_OPACITY) return;
        if (leaf.first) alpha *= num(getComputedStyle(leaf.first).opacity, 1);
        if (alpha <= AUDIT_MIN_OPACITY) return;
        var grow = 0;
        if (!leaf.plain) {
          var cs = getComputedStyle(el);
          var fill = cs.fill && cs.fill !== "none" && num(cs.fillOpacity, 1) > AUDIT_MIN_OPACITY;
          var stroke = cs.stroke && cs.stroke !== "none" && num(cs.strokeWidth, 1) > 0 && num(cs.strokeOpacity, 1) > AUDIT_MIN_OPACITY;
          if (!fill && !stroke) return; // an invisible helper, such as a motion path
          if (stroke) grow = num(cs.strokeWidth, 1) * perUnit / 2; // getBoundingClientRect leaves the stroke out
        }
        var r = el.getBoundingClientRect();
        var x0 = (r.left - rr.left) * k - grow;
        var y0 = (r.top - rr.top) * k - grow;
        var x1 = (r.right - rr.left) * k + grow;
        var y1 = (r.bottom - rr.top) * k + grow;
        if (!(x1 - x0 > 0.5 || y1 - y0 > 0.5)) return; // no box
        if (x1 <= 0 || y1 <= 0 || x0 >= cfg.width || y0 >= cfg.height) return; // wholly off the frame: not on screen
        var inBand = false;
        if (band) {
          var w = Math.min(x1, band[2]) - Math.max(x0, band[0]);
          var h = Math.min(y1, band[3]) - Math.max(y0, band[1]);
          if (w > BAND_TOLERANCE && h > BAND_TOLERANCE) { inBand = true; note(el, "band", time, h, null, zoom); }
        }
        if (safe) {
          // the band lies outside the safe zone; its own finding already covers the bottom edge
          var edges = [["left", safe[0] - x0], ["top", safe[1] - y0], ["right", x1 - safe[2]], ["bottom", y1 - safe[3]]];
          edges.forEach(function (e) {
            if (e[1] > SAFE_TOLERANCE && !(inBand && e[0] === "bottom")) note(el, "safe", time, e[1], e[0], zoom);
          });
        }
      });
    });
    tl.seek(0, false);

    var beatAt = function (time) {
      var hit = cfg.beats.filter(function (b) { return time >= b.start - 0.001 && time <= b.end + 0.001; })[0];
      return hit ? hit.id : null;
    };
    // group by element and merge the sample times into spans
    var bandList = [];
    var safeList = [];
    found.forEach(function (perEl, el) {
      var name = auditName(el, stage);
      if (perEl.band) {
        var spans = auditSpans(perEl.band.times, AUDIT_STEP);
        var longest = Math.max.apply(null, spans.map(function (s) { return s[1] - s[0]; }));
        bandList.push({ name: name, spans: spans, beat: beatAt(spans[0][0]), depth: perEl.band.depth, zoom: perEl.band.zoom, blocking: longest >= BAND_BLOCKING_SEC - 1e-9 });
      }
      if (perEl.safe) {
        var sSpans = auditSpans(perEl.safe.times, AUDIT_STEP);
        var edges = Object.keys(perEl.safe.edges).map(function (e) { return e + " by " + round(perEl.safe.edges[e], 0); });
        safeList.push({ name: name, spans: sSpans, beat: beatAt(sSpans[0][0]), edges: edges, zoom: perEl.safe.zoom });
      }
    });
    var byTime = function (a, b) { return a.spans[0][0] - b.spans[0][0]; };
    bandList.sort(byTime);
    safeList.sort(byTime);

    var where = function (f) {
      var lastBeat = beatAt(f.spans[f.spans.length - 1][1]);
      var several = f.spans.length > 1 || lastBeat !== f.beat;
      return spanText(f.spans) + (f.beat ? (several ? " (from beat " : " (beat ") + f.beat + ")" : "");
    };
    var camera = function (f) { return f.zoom && Math.abs(f.zoom - 1) > 0.02 ? " The camera is at zoom " + f.zoom + " there: a camera move pushes the rest of the stage outward." : ""; };
    var blocking = bandList.filter(function (f) { return f.blocking; });
    var brief = bandList.filter(function (f) { return !f.blocking; });
    var bandText = function (f) {
      return "caption band: " + f.name + " overlaps the burned captions " + round(f.depth, 0) + " units deep at " + where(f) + ", inside " + JSON.stringify(band) + "." + camera(f) +
        " Move it above y=" + band[1] + ", shrink it, fade it out first, or ease the camera (a smaller zoom or pad).";
    };
    blocking.slice(0, AUDIT_MAX_REPORTS).forEach(function (f) { problem(bandText(f)); });
    if (blocking.length > AUDIT_MAX_REPORTS) problem("caption band: " + (blocking.length - AUDIT_MAX_REPORTS) + " more element(s) overlap the burned captions.");
    brief.slice(0, AUDIT_MAX_REPORTS).forEach(function (f) { warn(bandText(f)); });
    safeList.slice(0, AUDIT_MAX_REPORTS).forEach(function (f) {
      warn("safe zone: " + f.name + " leaves " + JSON.stringify(safe) + " (" + f.edges.join(", ") + " units) at " + where(f) + "." + camera(f) +
        " Platform controls cover the margins, so keep text and key shapes inside the zone.");
    });
    if (safeList.length > AUDIT_MAX_REPORTS) warn("safe zone: " + (safeList.length - AUDIT_MAX_REPORTS) + " more element(s) leave the safe zone.");
    return {
      samples: times.length,
      band: bandList.map(function (f) { return { selector: f.name, from: f.spans[0][0], to: f.spans[f.spans.length - 1][1], blocking: f.blocking }; }),
      safe: safeList.map(function (f) { return { selector: f.name, from: f.spans[0][0], to: f.spans[f.spans.length - 1][1], edges: f.edges }; })
    };
  }

  /* -------------------------------------------------------------------- kit */

  function create() {
    var cfg = readConfig();
    var kit = {
      version: VERSION,
      primitives: PRIMITIVES.slice(),
      _cfg: cfg,
      _state: null,
      _swap: new Map(),
      _captions: null,
      _counts: new Map(),
      _countOrigin: new WeakMap(),
      _beats: [],
      _registered: false,
      timeline: null,
      report: null,
      audit: null,

      beat: function (id, fn) {
        if (kit._registered) fail('kit.beat("' + id + '") was called after kit.register(). Declare every beat first.');
        if (typeof id !== "string" || typeof fn !== "function") fail('kit.beat needs an id and a function: kit.beat("b01", (b) => { ... }).');
        if (!cfg.byId[id]) {
          fail('kit.beat("' + id + '") names a beat that is not in script.json. Known beats: ' + cfg.beats.map(function (b) { return b.id; }).join(", ") + ".");
        }
        if (kit._beats.some(function (b) { return b.id === id; })) fail('kit.beat("' + id + '") was declared twice.');
        kit._beats.push({ id: id, fn: fn });
        return kit;
      },

      register: function () {
        if (kit._registered) fail("kit.register() was called twice.");
        kit._registered = true;
        requirePlugins();
        var tl = gsap.timeline({ paused: true });
        kit.timeline = tl;
        var build = function () {
          try {
            kit._build(tl);
          } catch (e) {
            global.__explainKitError = e.message;
            if (global.console && console.error) console.error(e.message);
            throw e;
          }
          var root = document.querySelector("[data-composition-id]");
          var key = (root && root.getAttribute("data-composition-id")) || "explain";
          global.__timelines = global.__timelines || {};
          global.__timelines[key] = tl;
          if (typeof global.__hfForceTimelineRebind === "function") global.__hfForceTimelineRebind();
        };
        // The caption layer is created now so its font starts loading with the rest of the page.
        kit._captions = prepareCaptions(kit);
        // Text metrics depend on the loaded fonts, so build once they are ready.
        if (document.fonts && document.fonts.ready) {
          void document.body.offsetHeight; // lay out once so fonts in use start loading
          document.fonts.ready.then(build);
        } else {
          build();
        }
        return tl;
      },

      _build: function (tl) {
        // 1. Every beat in script.json needs a script, otherwise it would sit still.
        var declared = {};
        kit._beats.forEach(function (b) { declared[b.id] = true; });
        var missing = cfg.beats.filter(function (b) { return !declared[b.id]; }).map(function (b) { return b.id; });
        if (missing.length) {
          fail("no kit.beat(...) for " + missing.join(", ") + ". Every beat needs motion; add a kit.beat for each id in script.json.");
        }
        kit._state = createState(cfg);
        cfg.beats.forEach(function (beat) {
          if (beat.subject && !document.querySelector(beat.subject)) {
            fail('beat "' + beat.id + '" has subject ' + JSON.stringify(beat.subject) + " but nothing in the STAGE matches it. Add the element or fix the subject in script.json.");
          }
        });

        // 2. Run the beat scripts: they only record intentions, in beat time.
        var all = [];
        var perBeat = {};
        kit._beats.forEach(function (b) {
          var beat = cfg.byId[b.id];
          var builder = createBuilder(kit, beat);
          b.fn(builder.api);
          if (!builder.ops.length) fail('beat "' + b.id + '" made no calls. Give it at least a draw, write, move or fade.');
          perBeat[b.id] = builder.ops;
          Array.prototype.push.apply(all, builder.ops);
        });

        // 3. Build tweens in time order so element state (hidden, camera, colours) chains correctly.
        all.sort(function (a, b) { return a.abs - b.abs; });
        all.forEach(function (op) { op.run(tl, op.abs); });
        driveCounts(kit, tl);
        if (kit._captions) {
          fitCaptions(kit, kit._captions);
          animateCaptions(tl, kit._captions);
        }
        kit._ambient = buildAmbient(kit, tl);

        // 4. Report holds, late subjects and unanimated shapes: advice for the author, never a switch for the gate.
        kit._checkSubjects(all);
        kit._checkStatic(all);
        kit.report = kit._makeReport(perBeat, all);
        global.__explainReport = kit.report;

        // 5. Measure where everything lands on screen against the safe zone and the caption band. The audit
        //    seeks the timeline through every sample and back to 0, so it also leaves the time-0 state in place
        //    (entrances hidden, counters at their start). A paused timeline that has never rendered would
        //    otherwise show the whole stage on the very first frame.
        kit.audit = auditStage(kit, tl);
        kit.report.audit = kit.audit;
        tl.seek(Math.min(0.01, tl.duration()), false);
        tl.seek(0, false);
      },

      // The Motion Gate wants each beat's subject on screen within 0.5 s of the beat start.
      _checkSubjects: function (all) {
        cfg.beats.forEach(function (beat) {
          if (!beat.subject) return;
          var subject = document.querySelector(beat.subject);
          var firstEntrance = Infinity;
          var firstTouch = Infinity;
          all.forEach(function (op) {
            op.targets.forEach(function (t0) {
              var t = live(kit, t0);
              if (!(t === subject || t.contains(subject) || subject.contains(t))) return;
              if (op.entrance) firstEntrance = Math.min(firstEntrance, op.abs);
              else firstTouch = Math.min(firstTouch, op.abs);
            });
          });
          if (firstEntrance === Infinity || firstTouch < firstEntrance) return; // on screen from the start, or earlier
          if (firstEntrance > beat.start + 0.45) {
            warn('beat "' + beat.id + '": its subject ' + beat.subject + " first appears at " + round(firstEntrance, 2) + "s, but the Motion Gate needs it visible within 0.5s of the beat start (" + round(beat.start, 2) + "s). Make the subject's own draw, grow, write or fade the first call of the beat, or place it with .at(0).");
          }
        });
      },

      // Shapes and text on screen from the first frame (never introduced) are not 3b1b style.
      _checkStatic: function (all) {
        var entrances = [];
        all.forEach(function (op) {
          if (op.entrance) op.targets.forEach(function (t) { entrances.push(live(kit, t)); });
        });
        var loose = [];
        Array.prototype.forEach.call(kit._state.stage.querySelectorAll("*"), function (el) {
          var tag = tagOf(el);
          if (!SHAPE[tag] && tag !== "text") return;
          if (el.closest("defs, clipPath, mask, marker, symbol, pattern")) return;
          var st = kit._state.elements.get(el);
          if (st && (st.gated || st.introduced)) return; // hidden until its entrance, or a morph target
          if (entrances.some(function (t) { return t === el || t.contains(el); })) return; // inside a group that enters
          var cs = getComputedStyle(el);
          if (num(cs.opacity, 1) === 0 || (!hasFill(el) && !hasStroke(el))) return; // invisible helper, such as a motion path
          loose.push(el.id ? "#" + el.id : "<" + tag + ">");
        });
        if (loose.length) {
          warn(loose.length + " shape(s) in the STAGE are on screen from the first frame because no draw, write, grow or fade introduces them: " + loose.slice(0, 6).join(", ") + (loose.length > 6 ? ", ..." : "") + ". Introduce each one, or remove it.");
        }
      },

      _makeReport: function (perBeat, all) {
        var total = cfg.total || (cfg.beats.length ? cfg.beats[cfg.beats.length - 1].end + 1 : 0);
        var spans = all.map(function (op) { return [op.abs, op.abs + op.span]; }).sort(function (a, b) { return a[0] - b[0]; });
        var gaps = [];
        var reach = 0;
        spans.forEach(function (s) {
          if (s[0] - reach > cfg.maxStatic - 0.1) gaps.push({ from: round(reach, 2), to: round(s[0], 2) });
          reach = Math.max(reach, s[1]);
        });
        // the gate judges motion up to the end of the last beat; the tail after it is a deliberate end hold
        var holdEnd = cfg.beats.length ? Math.min(total, cfg.beats[cfg.beats.length - 1].end) : total;
        if (holdEnd - reach > cfg.maxStatic - 0.1) gaps.push({ from: round(reach, 2), to: round(holdEnd, 2) });
        gaps.forEach(function (g) {
          var beat = cfg.beats.filter(function (b) { return g.from >= b.start - 0.001 && g.from <= b.end + 0.001; })[0];
          warn("nothing moves from " + g.from + "s to " + g.to + "s" + (beat ? " (beat " + beat.id + ")" : "") + ". The Motion Gate fails holds longer than " + cfg.maxStatic + "s. Add a move, indicate, camera or fade there, using .at(sec) to place it.");
        });
        var beats = cfg.beats.map(function (beat) {
          var ops = perBeat[beat.id] || [];
          ops.forEach(function (op) {
            if (op.abs >= beat.end + 0.3) warn(op.where + " starts at " + round(op.abs, 2) + "s, after its narration ends at " + round(beat.end, 2) + "s. Pull it earlier with .at(sec).");
          });
          return { id: beat.id, start: beat.start, end: beat.end, motions: ops.length, prims: ops.map(function (op) { return op.prim; }) };
        });
        return {
          total: total,
          maxStaticSec: cfg.maxStatic,
          gaps: gaps,
          beats: beats,
          captions: kit._captions ? { burn: true, chunks: kit._captions.chunks.length, size: kit._captions.size } : { burn: false }
        };
      }
    };
    return kit;
  }

  global.ExplainKit = { version: VERSION, primitives: PRIMITIVES.slice(), create: create };
})(typeof window !== "undefined" ? window : globalThis);
