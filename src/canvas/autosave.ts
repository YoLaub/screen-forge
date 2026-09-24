/**
 * Debounced save: runs `save` once `delayMs` after the last `schedule()`.
 * Saves never overlap; a change made during a save triggers one more save.
 */
export function createAutosave(
  save: () => Promise<void>,
  delayMs: number,
  onError: (error: unknown) => void = console.error,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saving = false;
  let pending = false;
  let blocked = false;

  async function run() {
    timer = undefined;
    if (blocked) return;
    if (saving) {
      pending = true;
      return;
    }
    saving = true;
    try {
      await save();
    } catch (error) {
      onError(error);
    } finally {
      saving = false;
    }
    if (pending) {
      pending = false;
      await run();
    }
  }

  return {
    schedule() {
      if (blocked) return;
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
    /** Stops all saves for good, e.g. when the canvas could not be loaded. */
    block() {
      blocked = true;
      clearTimeout(timer);
    },
  };
}
