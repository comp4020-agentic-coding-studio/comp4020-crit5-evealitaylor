# Process overview

## What I built

**SPACEWALK** — an astronaut with jet boots drifts in space through a debris field.
The pointer steers, a tap spends a booster. The tap that starts a run is the same
tap that spends the booster, meaning the start explains the game. Hitting debris
spins the astronaut around and reduces the health bar. Play ends when either the
astronaut reaches the spacecraft, or their health drops to 0 from too many hits.

## The moments that mattered

Both came from playing it, not from reading it.

**1. Debris that couldn't kill you.** When initially testing the game, I was being
hit by debris but my astronaut wasn't dying and the game didn't restart. My initial
fix was to make the death happen from a single hit. However, this made the game kind
of boring because its possible to just die too soon. In order to resolve this, a hit
will have varying impact: three for a dead-on, one for a clip — both still spinning
you out, and a health bar shows the status.
[`57a1a37`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/57a1a37),
[`71b262b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/71b262b)

![The ring draining across one run: green, amber, red, then death](docs/health-bands.png)

**2. A destination that read as scenery.** In the first build, the spacecraft sat in the background for
most of the run, making the goal confusing rather than clear. I removed it from the run so it now
arrives with the final stretch, as the field thins. This gives the impression for most
of the game that the player is floating in space and the end goal is unclear, and players
are rewarded with the end goal after playing well, rather than aiming for it all along.
[`71b262b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-evealitaylor/commit/71b262b)
