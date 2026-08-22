// Self-contained tsdown build for tokens-core (an out-of-tree DSH plugin).
//
// Two artifacts land in lib/:
//   - lib/index.js   host half, ESM for Node (Loader imports it).
//   - lib/client.js  browser half, CJS wrapped in window.__ModuleLoader__.load
//                    so the client module system adopts { apply, inject }.
//
// Mirrors the harness preset (packages/client/tsdown.client.ts) but stays
// independent of the read-only submodule: platform modules are `external`
// (resolved from the loader's runtime require table) and `*.module.css` is
// compiled with lightningcss into a class map + an auto-injected <style> tag.
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

// The specifiers the shell shares into the frozen module table
// (packages/client/web/src/platform.ts) plus the runtime store exemption.
const CLIENT_EXTERNALS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-api-remotes/client',
]

// Compile `*.module.css` to a hashed class map and inject its CSS as a scoped
// <style> tag at module load. The virtual id must NOT end in `.css` (tsdown's
// css-guard matches that suffix), so it is wrapped in a prefix + `.mjs` suffix
// — same technique as the harness preset.
const CSS_MOD_PREFIX = '\0css-mod:'
const CSS_MOD_SUFFIX = '.mjs'
const cssModulesPlugin = {
  name: 'tokens-core-css-modules',
  resolveId(source: string, importer: string | undefined): string | null {
    if (!source.endsWith('.module.css')) return null
    const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
    return CSS_MOD_PREFIX + abs + CSS_MOD_SUFFIX
  },
  load(this: { addWatchFile: (id: string) => void }, id: string): string | null {
    if (!id.startsWith(CSS_MOD_PREFIX)) return null
    const file = id.slice(CSS_MOD_PREFIX.length, -CSS_MOD_SUFFIX.length)
    this.addWatchFile(file) // rebuild when the stylesheet changes
    const { code, exports: cssExports } = transform({
      filename: file,
      code: readFileSync(file),
      cssModules: { pattern: '[hash]_[local]' },
      minify: true,
    })
    const classMap: Record<string, string> = {}
    for (const [local, exp] of Object.entries(cssExports ?? {})) classMap[local] = exp.name
    const tagId = `dsh-tokensapi-ui/${basename(file)}`
    return [
      `const css = ${JSON.stringify(code.toString())};`,
      `const tagId = ${JSON.stringify(tagId)};`,
      `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
      `  const tag = document.createElement('style');`,
      `  tag.dataset.plugin = 'dsh-tokensapi-ui';`,
      `  tag.dataset.pluginCss = tagId;`,
      `  tag.textContent = css;`,
      `  document.head.appendChild(tag);`,
      `}`,
      `export default ${JSON.stringify(classMap)};`,
    ].join('\n')
  },
}

// Inline a plain (non-module) `.css` file as its raw text (default-exported
// string) — used for the global design-system theme sheets, which must keep
// their literal class names (`.theme-card`, …) rather than be hashed. Same
// `.mjs`-suffixed virtual id trick to dodge tsdown's css-guard.
const RAW_CSS_PREFIX = '\0raw-css:'
const RAW_CSS_SUFFIX = '.mjs'
const rawCssPlugin = {
  name: 'tokens-core-raw-css',
  resolveId(source: string, importer: string | undefined): string | null {
    if (!source.endsWith('.css') || source.endsWith('.module.css')) return null
    const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
    return RAW_CSS_PREFIX + abs + RAW_CSS_SUFFIX
  },
  load(this: { addWatchFile: (id: string) => void }, id: string): string | null {
    if (!id.startsWith(RAW_CSS_PREFIX)) return null
    const file = id.slice(RAW_CSS_PREFIX.length, -RAW_CSS_SUFFIX.length)
    this.addWatchFile(file)
    const css = existsSync(file) ? readFileSync(file, 'utf8') : ''
    return `export default ${JSON.stringify(css)}`
  },
}

const mode = process.env.NODE_ENV ?? 'production'

const host: UserConfig = {
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  // Emit lib/index.js (not .mjs) to match package.json main/exports; the
  // package is "type": "module", so a .js file is ESM.
  fixedExtension: false,
  dts: false,
  clean: false,
  sourcemap: true,
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-agent',
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-tools',
  ],
}

const client: UserConfig = {
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  sourcemap: true,
  external: [...CLIENT_EXTERNALS],
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    'import.meta.env.MODE': JSON.stringify(mode),
    'import.meta.env': JSON.stringify({ MODE: mode }),
  },
  plugins: [cssModulesPlugin, rawCssPlugin],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: 'window.__ModuleLoader__.load({ id: "dsh-tokensapi-ui", factory: (require) => {',
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [host, client]
