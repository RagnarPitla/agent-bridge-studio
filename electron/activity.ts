import { randomUUID } from 'node:crypto';

export type ActivityKind = 'task' | 'insights' | 'ideation' | 'changelog' | 'context' | 'other';
export type ActivityStatus = 'running' | 'done' | 'error';

export interface Activity {
  id: string;
  kind: ActivityKind;
  title: string;
  projectPath: string;
  /** True if the activity can modify files (autopilot/code). */
  write: boolean;
  /** Optional finer scope (relative paths/labels). Empty => project-wide. */
  scope: string[];
  status: ActivityStatus;
  startedAt: string;
  endedAt?: string;
  /** IDs of other running activities this one may conflict with. */
  conflictsWith: string[];
  windowId?: number;
}

export interface StartInput {
  kind: ActivityKind;
  title: string;
  projectPath: string;
  write?: boolean;
  scope?: string[];
  windowId?: number;
}

/**
 * Shared, in-process source of truth for what every agent (task runs and
 * feature AI calls, across all windows) is currently doing. main broadcasts the
 * full list to every window on each change so agents can coordinate instead of
 * competing, and so any window can show all agents working in one place.
 */
export class ActivityRegistry {
  private activities = new Map<string, Activity>();

  /** Called after any mutation so the caller can broadcast the new list. */
  onChange: (() => void) | null = null;

  list(): Activity[] {
    return [...this.activities.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  start(input: StartInput): Activity {
    const activity: Activity = {
      id: randomUUID(),
      kind: input.kind,
      title: input.title,
      projectPath: input.projectPath,
      write: input.write ?? false,
      scope: input.scope ?? [],
      status: 'running',
      startedAt: new Date().toISOString(),
      conflictsWith: [],
      windowId: input.windowId,
    };
    this.activities.set(activity.id, activity);
    this.recomputeConflicts();
    this.emit();
    return activity;
  }

  finish(id: string, status: ActivityStatus = 'done'): void {
    const activity = this.activities.get(id);
    if (!activity) return;
    activity.status = status;
    activity.endedAt = new Date().toISOString();
    activity.conflictsWith = [];
    this.activities.delete(id);
    this.recomputeConflicts();
    this.emit();
  }

  /** Conflicts for a hypothetical or real activity id (running write activities
   * in the same project with overlapping scope). */
  conflictsFor(id: string): Activity[] {
    const target = this.activities.get(id);
    if (!target) return [];
    return target.conflictsWith
      .map((cid) => this.activities.get(cid))
      .filter((a): a is Activity => Boolean(a));
  }

  private overlaps(a: Activity, b: Activity): boolean {
    if (a.id === b.id) return false;
    if (a.status !== 'running' || b.status !== 'running') return false;
    if (!a.write || !b.write) return false; // only writers can clobber each other
    if (a.projectPath !== b.projectPath) return false;
    if (a.scope.length === 0 || b.scope.length === 0) return true; // project-wide
    return a.scope.some((s) => b.scope.includes(s));
  }

  private recomputeConflicts(): void {
    const all = [...this.activities.values()];
    for (const a of all) a.conflictsWith = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (this.overlaps(all[i], all[j])) {
          all[i].conflictsWith.push(all[j].id);
          all[j].conflictsWith.push(all[i].id);
        }
      }
    }
  }

  private emit(): void {
    this.onChange?.();
  }
}
