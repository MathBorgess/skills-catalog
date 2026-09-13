(function () {
  var LABELS = {
    en: {
      right: "Correct.", wrong: "Not this one.", doubt: "Doubt / attention", observed: "What I observed",
      copy: "Copy resume prompt", copied: "Copied. Paste it into any agent session.", select: "Select the text above and copy it.",
      result: "Result", score: "Score", mode: "Mode", marked: "Marked", correct: "Correct", blank: "not answered",
      isWrong: "wrong", isRight: "right, with a note", step: "Step"
    },
    pt: {
      right: "Correta.", wrong: "Não é esta.", doubt: "Dúvida / atenção", observed: "O que observei",
      copy: "Copiar prompt de retomada", copied: "Copiado. Cole em qualquer sessão do agente.", select: "Selecione o texto acima e copie.",
      result: "Resultado", score: "Placar", mode: "Modo", marked: "Marcada", correct: "Correta", blank: "sem resposta",
      isWrong: "errada", isRight: "certa, com nota", step: "Passo"
    }
  };
  var t = LABELS[(document.documentElement.lang || "en").slice(0, 2)] || LABELS.en;

  // Answers and notes survive a reloaded tab. One key per lesson file.
  var KEY = "teach-me:" + location.pathname;
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  function text(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }

  function note(parent, key, label, open) {
    var box = document.createElement("details");
    box.className = "note";
    box.open = open || !!state[key];
    var summary = document.createElement("summary");
    summary.textContent = label;
    var area = document.createElement("textarea");
    area.rows = 3;
    area.value = state[key] || "";
    area.addEventListener("input", function () { state[key] = area.value; save(); });
    box.append(summary, area);
    parent.appendChild(box);
    return { box: box, area: area };
  }

  function resumePanel(after, body) {
    var panel = document.createElement("div");
    panel.className = "resume";
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = t.copy;
    var out = document.createElement("textarea");
    out.readOnly = true;
    out.rows = 10;
    out.hidden = true;
    var msg = document.createElement("p");
    msg.className = "copied";
    btn.addEventListener("click", function () {
      var brief = document.getElementById("resume-brief");
      out.value = ["teach-me resume", "", brief ? brief.textContent.trim() : "", "", body()].join("\n");
      out.hidden = false;
      out.select();
      function done() { msg.textContent = t.copied; }
      function fallback() {
        try { if (document.execCommand("copy")) return done(); } catch (e) {}
        msg.textContent = t.select;
      }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(out.value).then(done, fallback);
      else fallback();
    });
    panel.append(btn, out, msg);
    after.after(panel);
    return panel;
  }

  document.querySelectorAll("form.quiz").forEach(function (form, f) {
    var questions = form.querySelectorAll(".q");
    var notes = [];

    questions.forEach(function (q, i) {
      var key = "quiz" + f + "-q" + i;
      q.querySelectorAll('input[type="radio"]').forEach(function (input) {
        if (state[key] === input.value) input.checked = true;
        input.addEventListener("change", function () { state[key] = input.value; save(); });
      });
      notes.push(note(q, key + "-doubt", t.doubt));
    });

    var panel = resumePanel(form, function () {
      var right = 0;
      var lines = [];
      questions.forEach(function (q, i) {
        var picked = q.querySelector('input[type="radio"]:checked');
        var ok = !!picked && picked.value === q.getAttribute("data-correct");
        var doubt = notes[i].area.value.trim();
        if (ok) right += 1;
        if (ok && !doubt) return;
        var correct = q.querySelector('input[value="' + q.getAttribute("data-correct") + '"]');
        lines.push("", "### " + text(q.querySelector(".stem")) + " (" + (ok ? t.isRight : t.isWrong) + ")");
        lines.push("- " + t.marked + ": " + (picked ? text(picked.closest("label")) : t.blank));
        lines.push("- " + t.correct + ": " + text(correct && correct.closest("label")));
        if (q.querySelector(".why")) lines.push("- " + text(q.querySelector(".why")));
        if (doubt) lines.push("- " + t.doubt + ": " + doubt);
      });
      return ["## " + t.result, "", t.mode + ": theory · " + t.score + ": " + right + "/" + questions.length].concat(lines).join("\n");
    });
    panel.hidden = true;

    function reveal() {
      var right = 0;
      questions.forEach(function (q, i) {
        var picked = q.querySelector('input[type="radio"]:checked');
        if (!picked) return;
        var ok = picked.value === q.getAttribute("data-correct");
        q.classList.add("is-revealed", ok ? "is-right" : "is-wrong");
        var result = q.querySelector(".result");
        if (result) result.textContent = ok ? t.right : t.wrong;
        if (ok) right += 1;
        else notes[i].box.open = true;
        q.querySelectorAll('input[type="radio"]').forEach(function (input) { input.disabled = true; });
      });
      var tally = form.querySelector(".tally");
      if (tally) {
        tally.hidden = false;
        tally.textContent = right + " / " + questions.length;
      }
      var btn = form.querySelector("button[type='submit']");
      if (btn) btn.disabled = true;
      form.classList.add("is-checked");
      panel.hidden = false;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      state["quiz" + f + "-checked"] = true;
      save();
      reveal();
    });
    if (state["quiz" + f + "-checked"]) reveal();
  });

  document.querySelectorAll("ol.steps").forEach(function (ol, f) {
    var steps = [];
    ol.querySelectorAll(":scope > li").forEach(function (li, i) {
      var key = "steps" + f + "-s" + i;
      steps.push({
        text: text(li),
        observed: note(li, key + "-observed", t.observed, true).area,
        doubt: note(li, key + "-doubt", t.doubt, true).area
      });
    });

    resumePanel(ol, function () {
      var lines = ["## " + t.result, "", t.mode + ": practice"];
      steps.forEach(function (s, i) {
        var observed = s.observed.value.trim();
        var doubt = s.doubt.value.trim();
        if (!observed && !doubt) return;
        lines.push("", "### " + t.step + " " + (i + 1) + ": " + s.text);
        if (observed) lines.push("- " + t.observed + ": " + observed);
        if (doubt) lines.push("- " + t.doubt + ": " + doubt);
      });
      return lines.join("\n");
    });
  });
})();
