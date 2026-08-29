import type { Circle, HitKind } from "./types.ts";

/**
 * How much of the touching distance counts as "dead on".
 *
 * Contact alone doesn't end a run. Clip a rock with the edge of the suit and
 * you tumble; take it in the chest and you don't. This fraction is the line
 * between those, measured against the distance at which the two circles first
 * touch — so it scales with the size of whatever you hit, and a satellite is
 * no more forgiving per pixel than a bolt.
 *
 * 0.55 is a feel number, not a derived one. It is deliberately generous:
 * roughly three quarters of the area inside contact is survivable, because a
 * player who has just been told (wordlessly) that touching is bad needs to
 * survive learning it.
 */
export const FATAL_FRACTION = 0.55;

/**
 * The rule the whole game turns on.
 *
 * Pure, and pure on purpose: no canvas, no clock, no DOM. That is what lets a
 * test pin it down. Whether the line it draws feels *fair* is a question only
 * playing can answer.
 */
export function classifyHit(
  astronaut: Circle,
  debris: Circle,
  fatalFraction: number = FATAL_FRACTION,
): HitKind {
  const dx = debris.x - astronaut.x;
  const dy = debris.y - astronaut.y;
  const contact = astronaut.r + debris.r;
  const distanceSquared = dx * dx + dy * dy;

  // Squared throughout: this runs against every piece of debris every frame,
  // and a square root per test buys nothing a comparison can't.
  if (distanceSquared >= contact * contact) return "miss";

  const core = contact * fatalFraction;
  if (distanceSquared <= core * core) return "fatal";

  return "graze";
}
