/** What a piece of debris did to the astronaut this frame. */
export type HitKind = "miss" | "graze" | "fatal";

/** Where a run is: waiting to begin, under way, or finished one of two ways. */
export type Phase = "title" | "flying" | "lost" | "won";

/**
 * Everything floating out here. The first five drift — they were already
 * tumbling before the astronaut arrived. The last two are under power and
 * steer at whoever is in front of them, which is what makes them the hard ones.
 */
export type DebrisKind =
  | "rock"
  | "shard"
  | "panel"
  | "bolts"
  | "satellite"
  | "asteroid"
  | "comet";

/** Collision is circle-against-circle; every body reduces to one of these. */
export interface Circle {
  x: number;
  y: number;
  r: number;
}
