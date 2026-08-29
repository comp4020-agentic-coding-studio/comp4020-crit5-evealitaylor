# Process overview

## What I built

**SPACEWALK** — an astronaut with jet boots drifts home through a debris field.
The pointer steers, a tap spends a booster. Since the spec forbids instructions
anywhere, the tap that starts a run is the same tap that spends the booster:
starting *is* the lesson.

## The moments that mattered

**1. The rule nobody may write down became a test.** "Teaches itself" is the
easiest line to breach by accident, so I made it mechanical first: a test
grepping the built `dist/` for *click to*, *press the*, *controls* and eleven
more. It started red against the template's own copy. [`4f5f8ce`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/4f5f8ce)

**2. A green check that was lying.** All 44 tests passed while the title read
**SPACEWAL** on a phone; only a screenshot caught it. Rather than just fix the
CSS, the lesson went into the harness — a sensor failing any `nowrap` rule
without a viewport-relative `font-size`, filed in `spec/sensors.test.ts` so it
outlives this brief. I broke it, watched it go red, restored it.
[`d6489f6`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/d6489f6), [`7b36da9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/7b36da9)

**3. The change that came from playing.** The report: *"i got hit a lot of times
and never actually died"*. Rather than restore instant death, a hit now drains a
six-point pool drawn as a ring inside the booster ring, so its cost is visible
as it lands. [`57a1a37`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/57a1a37)

![The ring draining across one run: green, amber, red, then death](docs/health-bands.png)

**4. Fixing "can be lost" broke "can be won".** A careful player now died around
90s of a 120s run, never seeing the rocket. Instead of tuning by feel I played
the real simulation across 40 seeds with a look-ahead policy, moved two spawn
intervals until it got home 24 times in 40 — worst run still dead at 64s — then
made that probe a test demanding *both* endings. [`71b262b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/71b262b)
