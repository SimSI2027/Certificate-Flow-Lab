// Guided tour controller. It only drives the same public app API a user would (seek / play / select / direction),
// so the tour can never disagree with the scenario model. Any user interaction pauses it; it resumes after inactivity.
export const TOUR_RESUME_MS = 25000;

export class Tour {
  constructor(steps, api, { resumeMs = TOUR_RESUME_MS, tickMs = 100, dwellMs = 1800 } = {}) {
    Object.assign(this, { steps, api, resumeMs, tickMs, dwellMs });
    this.state = 'idle'; // idle | running | paused | finished
    this.index = 0; this.phase = 'enter'; this.dwellLeft = 0;
    this.timer = null; this.resumeTimer = null;
  }

  start() {
    this.clearTimers(); this.index = 0; this.phase = 'enter'; this.state = 'running';
    this.api.onTourChange?.(this); this.loop();
  }

  loop() { clearInterval(this.timer); this.timer = setInterval(() => this.tick(), this.tickMs); }

  stop() { this.clearTimers(); this.state = 'idle'; this.api.onTourChange?.(this); }

  clearTimers() { clearInterval(this.timer); clearTimeout(this.resumeTimer); this.timer = null; this.resumeTimer = null; }

  // Called for every user interaction outside the tour's own actions.
  interrupt() {
    if (this.state === 'finished' || this.state === 'idle') return;
    clearInterval(this.timer); this.timer = null;
    this.state = 'paused';
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => this.resume(), this.resumeMs);
    this.api.onTourChange?.(this);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.phase = 'enter'; this.state = 'running'; this.api.onTourChange?.(this); this.loop();
  }

  get step() { return this.steps[this.index]; }

  tick() {
    if (this.state !== 'running') return;
    const st = this.step;
    if (this.phase === 'enter') {
      this.api.guard(() => this.api.applyTourStep(st));
      this.phase = 'playing';
      this.api.onTourChange?.(this);
      return;
    }
    if (this.phase === 'playing') {
      if (this.api.tourStepDone(st)) { this.phase = 'dwell'; this.dwellLeft = st.handoff ? 0 : this.dwellMs / Math.max(0.25, this.api.speed()); }
      return;
    }
    if (this.phase === 'dwell') {
      this.dwellLeft -= this.tickMs;
      if (this.dwellLeft > 0) return;
      if (st.handoff || this.index >= this.steps.length - 1) { this.finish(); return; }
      this.index += 1; this.phase = 'enter'; this.api.onTourChange?.(this);
    }
  }

  finish() {
    this.clearTimers(); this.state = 'finished';
    this.api.guard(() => this.api.handoff());
    this.api.onTourChange?.(this);
  }
}
