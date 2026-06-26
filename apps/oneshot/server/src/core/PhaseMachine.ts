export class PhaseMachine<TPhase extends string> {
  constructor(
    private currentPhase: TPhase,
    private readonly transitions: Partial<Record<TPhase, TPhase[]>>,
  ) {}

  current(): TPhase {
    return this.currentPhase;
  }

  move(nextPhase: TPhase): void {
    const allowed = this.transitions[this.currentPhase] ?? [];
    if (!allowed.includes(nextPhase)) {
      throw new Error(`Invalid phase transition: ${this.currentPhase} -> ${nextPhase}`);
    }
    this.currentPhase = nextPhase;
  }
}
