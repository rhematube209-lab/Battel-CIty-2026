/**
 * Minimal, robust Score System for Battle City 2026.
 * Tracks and formats arcade score with zero-padding (e.g. 000100).
 */
export class ScoreSystem {
  private score: number = 0;

  constructor(initialScore: number = 0) {
    this.score = initialScore;
  }

  /**
   * Adds points to current score and returns updated score.
   */
  public addScore(points: number): number {
    if (points > 0) {
      this.score += points;
    }
    return this.score;
  }

  /**
   * Returns current raw numeric score.
   */
  public getScore(): number {
    return this.score;
  }

  /**
   * Returns 6-digit zero-padded score string suitable for arcade HUD display.
   * e.g., 0 -> "000000", 100 -> "000100", 1200 -> "001200"
   */
  public getFormattedScore(): string {
    return this.score.toString().padStart(6, '0');
  }

  /**
   * Resets score to zero on full stage restart.
   */
  public reset(): void {
    this.score = 0;
  }
}
