import { readFileSync } from 'node:fs';

const client = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
for (const marker of ['tokens-local-theme-preview', 'dsh-tokensapi-ui-local-theme-preview', 'LocalThemePreview', 'resolveLocalTheme']) {
  if (client.includes(marker)) throw new Error(`Release contains local theme preview: ${marker}`);
}
if (!client.includes('tokens-debug-theme-preview')) throw new Error('Release is missing authorized theme debugging.');
console.log('Release theme verified: authorized debugging included, unrestricted local override excluded.');
