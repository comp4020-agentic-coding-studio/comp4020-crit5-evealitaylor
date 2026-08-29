# Crit 5 — SPACEWALK

## The breakthrough

Watching a test go green and then finding the thing broken anyway. Every test in
the repo was happy while the title clipped to **SPACEWAL** on a phone, and the
only reason I found it was that I opened a screenshot. That reframed what the
checks are for. They aren't proof the work is good; they're a record of the
specific ways I already know it can go wrong. So the fix wasn't the CSS — it was
adding a sensor for the class of bug, in a file that carries into next week
rather than one that retires with this brief.

The same idea paid off twice. When the feedback came back — hit constantly,
never actually dying — I could have nudged numbers until it felt right. Instead
I played the real simulation across forty seeds with a policy standing in for an
attentive player, and used the numbers to move two spawn intervals. What made
that possible was a decision from day one: keep the simulation pure and free of
the canvas, so it can be played without a browser. Architecture I chose for
testability turned out to be the thing that let me *measure* a design question I
would otherwise have guessed at.

## What it changed

I've started treating "the tests pass" as the beginning of verification rather
than the end of it. The agent is very good at making checks green and completely
indifferent to whether the green means anything, which makes deciding *what
gets checked* the part that is actually mine. I want to be the developer whose
judgement is written down where it keeps working — in the harness — rather than
re-supplied by hand every time.
