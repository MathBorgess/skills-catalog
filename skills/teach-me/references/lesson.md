# Lesson HTML — what the user consumes

The markdown session note is the operator record. The HTML file is the **lesson**: the thing they open on a phone in a queue, on a commute, or at a desk. Location and a short window must not cancel the session.

If the practice environment is not here (no console, phone-only, ten minutes), ship a **theory** lesson and label it `theory`. Do not skip the day. Practice is the default only when the environment is actually available in this sitting.

Copy `assets/lesson.css` and `assets/quiz.js` from this skill into the workspace assets path on the first lesson (see [`layouts.md`](layouts.md)). Reuse them. Do not inline a new stylesheet per lesson. Do not load fonts, CSS, or JS from a CDN.

## File

One HTML file per session, same slug as the session note. Self-contained except for those two relative assets. Open it for the user when a CLI can (`open` on macOS).

Completable inside the daily budget. One mechanism. One visible win in the header. No sidenotes, no hover, no two-column Tufte layout.

## Skeleton

```html
<!DOCTYPE html>
<html lang="<notes language from profile>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><one idea> — <exam code></title>
  <link rel="stylesheet" href="../assets/lesson.css">
</head>
<body>
  <article class="lesson">
    <p class="kicker"><CODE> · <domain> · ~<n> min</p>
    <h1><one idea, one line></h1>
    <p class="win">When you finish: <observable win>.</p>

    <h2>The distinction</h2>
    <p><the mechanism, short. One comparison table if the exam distinguishes siblings.></p>

    <h2>Do this</h2>
    <!-- theory: form.quiz below. practice: ol.steps — navigation names, checkpoints, the failure to provoke. No finished notebook. -->

    <p class="source">Primary source: <a href="...">...</a></p>
    <p class="ask">When you finish, send the agent the tally (n/m) and which items felt like a guess. The wiki cannot log a miss you only tapped in the page.</p>
  </article>
  <script src="../assets/quiz.js"></script>
</body>
</html>
```

## Theory quiz

Answers live in the HTML but stay **hidden until Submit**. The chat message still has no answer key.

- 5–8 items, exam format, qualifier in caps, two plausible options.
- Option text as close to the same length as you can make it.
- `data-correct` on each `.q` is the winning `value`.
- `.why` is the trap in one line. Reveal is `quiz.js`'s job.

```html
<form class="quiz">
  <div class="q" data-correct="b">
    <p class="stem">1. A company needs X under constraint Y. Which option is MOST …?</p>
    <label class="opt"><input type="radio" name="q1" value="a"> A. …</label>
    <label class="opt"><input type="radio" name="q1" value="b"> B. …</label>
    <label class="opt"><input type="radio" name="q1" value="c"> C. …</label>
    <label class="opt"><input type="radio" name="q1" value="d"> D. …</label>
    <p class="why">Trap: <the discriminating word as a rule>.</p>
    <p class="result"></p>
  </div>
  <button type="submit">Check</button>
  <p class="tally" hidden></p>
</form>
```

After they submit (in the HTML or by sending letters in chat), grade in the session note and the error ledger as [`session.md`](session.md) says. A correct tap with a wrong written reason in chat is still a miss.

## Practice brief

The HTML is the briefing they can read anywhere. The evidence still needs the environment, later in the same day is fine.

`ol.steps`: objective in one line, where in the console and the **name the platform uses**, checkpoints ("after step 2 you should see X"), the failure to provoke. Not the finished config.

## Do not

- Desktop-only layout, hover sidenotes, or a page that needs pinch-zoom to read.
- A lesson longer than the daily budget.
- Mixing two unrelated exams on one page.
- Putting the key in the agent message "because the HTML also has it".
- Logging the HTML as `practice`. It is the lesson; practice is the artifact they produced in the environment.
