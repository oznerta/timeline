import { TimelineData } from '@/types/timeline';

export class TimelineHistoryManager {
  private past: TimelineData[] = [];
  private future: TimelineData[] = [];
  private present: TimelineData;
  private maxHistory: number;

  constructor(initialData: TimelineData, maxHistory: number = 50) {
    this.present = initialData;
    this.maxHistory = maxHistory;
  }

  get currentState(): TimelineData {
    return this.present;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  push(newState: TimelineData): void {
    this.past.push(this.present);
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    this.present = newState;
    this.future = [];
  }

  undo(): TimelineData | null {
    if (!this.canUndo) return null;
    const previous = this.past.pop()!;
    this.future.unshift(this.present);
    this.present = previous;
    return this.present;
  }

  redo(): TimelineData | null {
    if (!this.canRedo) return null;
    const next = this.future.shift()!;
    this.past.push(this.present);
    this.present = next;
    return this.present;
  }

  reset(initialData: TimelineData): void {
    this.present = initialData;
    this.past = [];
    this.future = [];
  }
}
