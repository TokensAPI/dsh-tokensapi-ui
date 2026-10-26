import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
for (const marker of ['tokens-local-theme-preview', 'dsh-tokensapi-ui-local-theme-preview', 'LocalThemePreview', 'resolveLocalTheme']) {
  if (client.includes(marker)) throw new Error(`Release contains local theme preview: ${marker}`);
}
console.log('Release theme verified: organization selection only, no local override.');
