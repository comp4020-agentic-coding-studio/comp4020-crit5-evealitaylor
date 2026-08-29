export interface Aim {
  x: number;
  y: number;
}

/**
 * Pointer and finger, reduced to an aim point and a press.
 *
 * Desktop steers on hover — the suit chases the cursor with nothing held down,
 * which is what lets the title screen teach the control before anyone has
 * clicked. Touch has no hover, so a finger down steers and a quick tap is the
 * press; a second finger counts as a press too, since a two-thumbed player
 * never lifts off.
 */
export class Pointer {
  readonly aim: Aim;
  private pending = false;
  private active = new Map<number, { x: number; y: number; at: number; moved: number }>();
  private offset: Aim = { x: 0, y: 0 };

  constructor(
    private surface: HTMLElement,
    private locate: () => Aim,
    start: Aim,
  ) {
    this.aim = { ...start };

    surface.addEventListener("pointermove", this.onMove, { passive: true });
    surface.addEventListener("pointerdown", this.onDown);
    surface.addEventListener("pointerup", this.onUp);
    surface.addEventListener("pointercancel", this.onUp);
    surface.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  private at(event: PointerEvent): Aim {
    const box = this.surface.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  }

  private onMove = (event: PointerEvent): void => {
    const point = this.at(event);
    if (event.pointerType === "touch") {
      const held = this.active.get(event.pointerId);
      if (!held) return;
      held.moved += Math.hypot(point.x - held.x, point.y - held.y);
      held.x = point.x;
      held.y = point.y;
      this.aim.x = point.x + this.offset.x;
      this.aim.y = point.y + this.offset.y;
      return;
    }
    this.aim.x = point.x;
    this.aim.y = point.y;
  };

  private onDown = (event: PointerEvent): void => {
    const point = this.at(event);

    if (event.pointerType === "touch") {
      // A second finger is a press on its own — nothing has to be let go of.
      if (this.active.size > 0) {
        this.pending = true;
        this.active.set(event.pointerId, { ...point, at: performance.now(), moved: 999 });
        return;
      }
      // Grab where the suit already is, so first contact never teleports it,
      // but keep it clear of the fingertip that would otherwise cover it.
      const here = this.locate();
      let dx = here.x - point.x;
      let dy = here.y - point.y;
      if (dy > -46) dy = -46;
      const reach = Math.hypot(dx, dy);
      if (reach > 150) {
        dx = (dx / reach) * 150;
        dy = (dy / reach) * 150;
      }
      this.offset = { x: dx, y: dy };
      this.active.set(event.pointerId, { ...point, at: performance.now(), moved: 0 });
      this.aim.x = point.x + dx;
      this.aim.y = point.y + dy;
      return;
    }

    this.aim.x = point.x;
    this.aim.y = point.y;
    this.pending = true;
  };

  private onUp = (event: PointerEvent): void => {
    const held = this.active.get(event.pointerId);
    this.active.delete(event.pointerId);
    if (!held || event.pointerType !== "touch") return;
    if (performance.now() - held.at < 250 && held.moved < 14) this.pending = true;
  };

  /**
   * A press is held until a simulation step actually consumes it, so a tap
   * that lands between fixed steps is never silently dropped.
   */
  takePress(): boolean {
    if (!this.pending) return false;
    this.pending = false;
    return true;
  }

  recentre(x: number, y: number): void {
    this.aim.x = x;
    this.aim.y = y;
  }
}
