(function () {
  function grade(q) {
    var picked = q.querySelector('input[type="radio"]:checked');
    var correct = q.getAttribute("data-correct");
    if (!picked) return null;
    return picked.value === correct;
  }

  document.querySelectorAll("form.quiz").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var questions = form.querySelectorAll(".q");
      var right = 0;
      questions.forEach(function (q) {
        var ok = grade(q);
        if (ok === null) return;
        q.classList.add("is-revealed", ok ? "is-right" : "is-wrong");
        var result = q.querySelector(".result");
        if (result) result.textContent = ok ? "Correct." : "Not this one.";
        if (ok) right += 1;
        q.querySelectorAll("input").forEach(function (input) {
          input.disabled = true;
        });
      });
      var tally = form.querySelector(".tally");
      if (tally) {
        tally.hidden = false;
        tally.textContent = right + " / " + questions.length;
      }
      var btn = form.querySelector("button[type='submit']");
      if (btn) btn.disabled = true;
    });
  });
})();
