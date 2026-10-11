import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Inline plain local CSS imports in source order; track every input for watch builds. */
export function readCss(file, onFile = () => {}, ancestors = []) {
  const absolute = resolve(file);
  if (ancestors.includes(absolute)) throw new Error(`Cyclic CSS import: ${absolute}`);
  onFile(absolute);
  const source = readFileSync(absolute, "utf8");
  return source.replace(/^[ \t]*@import ["'](\.[^"']+\.css)["'];[ \t]*(?:\r?\n|$)/gm, (_rule, relative) =>
    readCss(resolve(dirname(absolute), relative), onFile, [...ancestors, absolute]),
  );
}
