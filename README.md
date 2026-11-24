# Product validation gates

A stage-gate method for deciding which AI product ideas earn a build, and a static web app that walks you through it.

**Live app:** https://sam-sida.github.io/product-validation-gates/

Built by Samuel Sida.

## Why this exists

Most AI ideas should not become products. The expensive failure is a slow yes: months of build on an idea that a week of evidence would have stopped.

Most teams already run an idea intake that asks about data rights, pain, market size, pricing, and unit costs. This method adds three things on top of that intake:

- **Stop rules set before the work starts.** Every gate states what would kill the idea, and the thresholds lock when the gate starts. No moving the goalposts after the evidence comes in.
- **An evidence pack.** One page with a recommendation (build, stop, or test first), the deciding gate, the numbers, and the open risks.
- **A decision log.** Every decision is recorded, so we can measure the quality of our nos as well as our yeses.

## The gates

Each gate has a stop rule and a time box. Effort matches the cost of being wrong: a cheap, reversible idea gets days, and an idea that puts client trust or a large build at stake gets weeks.

| Gate | Question | Stop if |
|---|---|---|
| 0. Screen | Is there a clear problem, a payer, a strategy fit, and a lawful path? | No clear problem or payer, no strategy fit, or the AI use case is prohibited, or high-risk with no compliance path |
| 1. Problem | Is the pain frequent or severe, and shared? | Fewer than 3 clients share it, or it's neither frequent nor severe |
| 2. Data and legal | Do we have the rights to the data for every user type? | A user type lacks rights, one client could see another's detail, or privacy or country rules block it |
| 3. Value and AI quality | Does the AI beat today's baseline, fast enough, and do people want it? | Evals don't beat the baseline, the tech spike misses latency or scale, or the smoke test converts below threshold |
| 4. Economics | Will it make money, repeatably? | Negative margin per use, a bespoke build costs less, the SOM is too small, or CLV:CAC is below 1 |
| Decision | Build, stop, or test first | |

Default time boxes in days:

| Cost of being wrong | Screen | Problem | Data and legal | Value and AI quality | Economics |
|---|---|---|---|---|---|
| Low | 1 | 3 | 3 | 5 | 3 |
| Medium | 2 | 5 | 5 | 10 | 5 |
| High | 3 | 10 | 10 | 20 | 10 |

### Gate 0: Screen

- Problem, payer (budget owner), strategy fit, and the data needed.
- **Regulatory compliance:** the regulated domains the idea touches (financial advice or credit, health, employment decisions, children, and consumer claims), the AI risk tier (minimal, limited, high-risk, or prohibited, in the style of risk-based rules such as the EU AI Act), whether a sector or regulator approval is needed, and whether a compliance path exists.
- An unknown compliance position doesn't stop the idea. It means test first, and the next test is to confirm the compliance position.

### Gate 1: Problem

Interviews plus a proxy: usage of the closest existing module tells us how often the pain shows up, without a new build.

### Gate 2: Data and legal

Map each user type to its data and its rights. First-party users see their own data. Supplier users, such as one brand, must never see a competitor's detail.

### Gate 3: Value and AI quality

- A golden dataset of real questions with expert answers.
- Evals that score the AI against today's baseline (an analyst template, rules, or search). The AI must beat it, not match it.
- A tech spike for latency and scale at expected peak load.
- A fake-door or smoke test to measure demand before the build.

### Gate 4: Economics

- **Market:** TAM, SAM, and SOM.
- **Willingness to pay:** a Van Westendorp survey. The app computes the acceptable price range (point of marginal cheapness to point of marginal expensiveness) and the optimal price point.
- **Unit economics:** inference cost per use from tokens in and out, model calls per use, other run costs, and margin per use.
- **Product vs bespoke:** the build cost spread across the three-year client plan plus run costs, compared with the cost of a bespoke build per client. This is the repeatability test.
- **Mini business case:**
  - CLV = annual revenue per client × gross margin × client lifetime. If you give churn instead, lifetime = 1 / churn.
  - CAC = acquisition spend ÷ new clients won.
  - CLV:CAC target: **above 2**. Below 1 stops the idea; 1 to 2 means test first.
  - CAC payback over 18 months also means test first.
  - A three-year view shows gross profit, acquisition spend, cumulative cash, and the break-even month.

### Decision logic

- Any stop rule hit means **Stop**. The pack names the deciding gate, and later gates are marked not reached.
- Every gate passing on evidence means **Build**.
- Otherwise, gaps in the evidence or a weak business case mean **Test first**. The pack names the cheapest next test.

## Measuring a no

A process that only counts its yeses will drift towards saying yes. The portfolio view tracks:

- **Share of ideas stopped at Gates 0 to 2.** Early, cheap stops are the goal. We'd rather stop ten ideas in a day each than one idea after a quarter.
- **Time and cost per decision**, and the cost of an early stop against a late stop.
- **A quarterly audit of stopped ideas.** Draw a random sample of the quarter's stops and ask whether today's evidence would still say no.
- **Hit rate of yeses**, compared with the hit rate of past productisations.

## Worked example

The app opens with a worked example: a consultant-built GenAI tool that analyses a retail category, such as chocolate bars, shows which brands are trending, and explains why.

- It passes Screen, Problem, and Data and legal.
- It beats the baseline on evals, but the scale spike hasn't run yet.
- Its CLV:CAC is about 1.8, below the target of above 2, and payback runs past 18 months.
- The recommendation is **Test first**: run the scale spike, then test a higher price or a lighter sales motion with two pilot clients.

All figures in the example are illustrative.

## Using the app

- Work through the gates in order, or jump between them with the stepper.
- Press **Start gate and lock rules** before you start the work on a gate.
- Download the evidence pack as Markdown, or use **Print or save as PDF** for a one-page PDF.
- Drafts and the decision log save in your browser's local storage only. There is no backend, no tracking, and no API key.

## Run it locally

The app is plain HTML, CSS, and JavaScript modules with no build step and no dependencies. Modules need a local server:

```
python -m http.server 8765
```

Then open http://localhost:8765/.

## Tests

The logic (stop rules, decision, economics, evidence pack, portfolio metrics, and storage) has unit tests written test-first. The tests run in the browser with a small zero-dependency runner:

- Start the local server above.
- Open http://localhost:8765/tests/tests.html.

A copy test also scans the app's text for banned words and US spellings.

## Project structure

```
index.html        app shell and gate screens
css/styles.css    layout and the print stylesheet
js/gates.js       gates, stop-rule thresholds, and time boxes
js/decision.js    gate evaluation and the recommendation
js/economics.js   market, Van Westendorp, unit economics, CLV, CAC, and the business case
js/pack.js        evidence pack in Markdown, and a small Markdown renderer
js/portfolio.js   portfolio metrics and the quarterly audit sample
js/storage.js     local storage with safe fallbacks
js/example.js     worked example and sample portfolio
js/app.js         UI wiring
tests/            browser test runner and unit tests
```

## Licence

MIT
