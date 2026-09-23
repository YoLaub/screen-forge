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

  async function run() {
    timer = undefined;
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
      clearTimeout(timer);
      timer = setTimeout(run, delayMs);
    },
  };
}
