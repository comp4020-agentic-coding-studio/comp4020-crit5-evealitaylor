# Process overview

## What I built

**SPACEWALK** — an astronaut with jet boots drifts in space through a debris field.
The pointer steers, a tap spends a booster. The tap that starts a run is the same
tap that spends the booster, meaning the start explains the game. Hitting debris
spins the astronaut around and reduces the health bar. Play ends when either the
astronaut reaches the spacecraft, or their health drops to 0 from too many hits.

## The moments that mattered

Both came from playing it, not from reading it.

**1. Debris that couldn't kill you.** I was hit constantly across a full run and
never died, so runs never resolved — and a game that can't be lost fails the
spec. The obvious fix was instant death. Instead a hit drains a six-point pool
— three for a dead-on, one for a clip — both still spinning you out, so its
cost is visible as it lands. Then that broke the other half: a
careful player now died around 90s of 120s, never seeing the rocket. Rather than
tune by feel I played the simulation across 40 seeds with a look-ahead policy,
moved two spawn intervals until it got home 24 times in 40 — worst run still
dead at 64s — then made that probe a test demanding *both* endings.
[`57a1a37`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/57a1a37),
[`71b262b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/71b262b)

![The ring draining across one run: green, amber, red, then death](docs/health-bands.png)

**2. A destination that read as scenery.** The ship sat in the background for
most of the run, making the goal confusing rather than clear. Bigger or brighter
would only make the wrong thing louder, so I removed it from the run: it now
arrives with the final stretch, as the field thins. Screenshotting the new
ending caught a fault it exposed — the wordmark faded back in across the docked
ship.
[`71b262b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/71b262b)
