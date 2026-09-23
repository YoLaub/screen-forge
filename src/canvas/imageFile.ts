/** The first image in a pasted or dropped file list. */
export function firstImageFile(files: ArrayLike<File> | undefined | null): File | undefined {
  return Array.from(files ?? []).find((f) => f.type.startsWith("image/"));
}
