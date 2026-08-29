# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## The checks

`pnpm check` runs them, and `pnpm check:evidence` is the extra gate before you
ship. CI runs the same plus links, secrets and the deploy.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the
harness is assessed. This file and the sensors you wire into `check` carry
across the course --- both come with you into next week's repo. The prototype
doesn't: source, and the tests answering this week's published spec, stay
behind. `spec/README.md` draws the line.

---

# Rules I hold the agent to

Grown from things that actually went wrong. Each one is here because I paid for
it once. Where a rule can be made mechanical it moves into `spec/sensors.test.ts`
and stops being my job to remember.

## Looking is not optional

**A green `pnpm check` means it compiles, not that it works.** Before saying a
visual thing is done, open the built page in a real browser and *look at it*, at
**1920x1080 and 390x844** — the two viewports it is marked at. Both count fully.
Screenshotting caught a title clipped to "SPACEWAL" on a phone that every test
in the repo was happy with.

**Drive the page over CDP, not `chrome --headless --window-size`.** The plain
`--window-size` path gave a layout that disagreed with the real one and sent me
chasing a centring bug that did not exist. Use
`Emulation.setDeviceMetricsOverride`, dispatch real `Input.*` events, and take
`Page.captureScreenshot`. Real pointer input at a real viewport, or it proves
nothing.

**Measure before fixing.** When a screenshot looks wrong, read
`getBoundingClientRect()` in the page before changing any CSS. The box was
centred to the pixel; the screenshot was lying.

## Type and fonts

**Size text against the *last* font in the stack, not the first.** Every
fallback is wider than the face I designed for, and the machine that marks this
is not mine. Any `white-space: nowrap` needs a viewport-relative `font-size` —
now enforced by a sensor.

## The build

**`tsconfig.json`'s `include` must name every source directory.** A new `src/`
went completely untypechecked and nothing complained. When adding a directory,
add it there in the same commit.

## Tests

**Contract tests and sensors live in different files.** `spec/crit-<n>.test.ts`
answers this week's published spec and stays behind; `spec/sensors.test.ts` is
harness and comes with me. Filing a sensor inside the week's contract file is
how a hard-won check gets thrown away at the end of the week.

**A sensor I have not seen go red is decoration.** Break the thing it guards,
watch it fail, restore, watch it pass. Then commit it.

## Process

**Commit at each moment worth citing**, with a message saying what was learned,
not just what changed — `PROCESS.md` cites these by SHA and
`pnpm check:evidence` resolves them.
