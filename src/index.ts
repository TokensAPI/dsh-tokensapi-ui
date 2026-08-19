// tokens-core host half.
//
// An ordinary DSH (Cordis) function plugin — NOT a Desktop plugin: it stays on
// official DSH contracts so it loads under `dsh web` as well as inside Desktop.
// The Loader imports this module for the entry `name: tokens-core` and calls
// apply(ctx) once at load. Core capabilities (services, commands, tools) grow
// here; the browser half lives in ./client and is served to the Web UI.
import type { Context } from '@deepseek-ai/cordis'

export const name = 'tokens-core'

export function apply(ctx: Context): void {
  ctx.logger.info('[tokens-core] host loaded')
}
