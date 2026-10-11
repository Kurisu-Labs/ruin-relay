/** Original synthesized cues. Optional, gesture-unlocked, and independent of game state. */
export class GameSound {
  private context?: AudioContext;
  private muted = true;
  private last = 0;
  async enable(enabled: boolean) {
    this.muted = !enabled;
    if (!enabled) {
      void this.context?.suspend().catch(() => {});
      return;
    }
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
    } catch {
      this.muted = true;
    }
  }
  play(cue: 'step' | 'blocked' | 'escape' | 'confirmed') {
    const context = this.context;
    if (this.muted || !context || context.state !== 'running') return;
    const time = context.currentTime;
    if ((cue === 'step' || cue === 'blocked') && time - this.last < 0.06) return;
    this.last = time;
    const notes =
      cue === 'escape'
        ? [330, 440, 660]
        : cue === 'confirmed'
          ? [440, 554, 880]
          : cue === 'blocked'
            ? [90]
            : [160];
    for (const [index, note] of notes.entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = time + index * 0.09;
      const duration = notes.length === 1 ? 0.07 : 0.2;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note, at);
      oscillator.frequency.exponentialRampToValueAtTime(note * 0.65, at + duration);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(notes.length === 1 ? 0.035 : 0.045, at + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.01);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    }
  }
  destroy() {
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
}
