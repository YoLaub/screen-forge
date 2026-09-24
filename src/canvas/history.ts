/**
 * Undo history of whole states (canvas snapshots). The current state is the
 * last recorded one; undo and redo return the state to restore, or null.
 */
export function createHistory<T>(limit: number) {
  let states: T[] = [];
  let index = -1;

  return {
    record(state: T) {
      if (index >= 0 && states[index] === state) return;
      states = [...states.slice(0, index + 1), state].slice(-limit);
      index = states.length - 1;
    },
    undo(): T | null {
      if (index <= 0) return null;
      index -= 1;
      return states[index];
    },
    redo(): T | null {
      if (index >= states.length - 1) return null;
      index += 1;
      return states[index];
    },
    canUndo: () => index > 0,
    canRedo: () => index < states.length - 1,
  };
}
