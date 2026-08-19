// Local type shim for the minimal DSH web-client surface tokens-core uses.
//
// The real types live in `@deepseek-ai/dsh-client-runtime` / `-ui-slots`, but
// their published rc packages pull an unpublished dependency (dsh-compact 404),
// so we declare just the surface we call. These specifiers are `external` in
// tsdown.config.ts and only ever imported as types here (erased at build), so
// the runtime still binds to the real loader-provided services. Widen this shim
// as tokens-core uses more of the client API.
declare module '@deepseek-ai/dsh-client-runtime/client' {
  import type { ComponentType } from 'react'

  /** A component contributed into a UI slot. */
  export interface SlotRegistration {
    /** Target slot name, e.g. 'sidebar.footer.action'. */
    name: string
    /** Stable id for this contribution within the slot. */
    id: string
    /** Ordering within a list slot (lower renders first). */
    order?: number
  }

  export interface SlotsService {
    /** Defer a registration until the named slot is declared. */
    inject(slot: string, register: () => unknown): void
    /** Contribute a component into a slot; returns a disposer. */
    register<P>(registration: SlotRegistration, component: ComponentType<P>): unknown
  }

  /** The browser-side Cordis context passed to a client plugin's apply(). */
  export interface ClientContext {
    slots: SlotsService
    /** Register a side effect; the returned disposer runs on plugin unload. */
    effect(setup: () => (() => void) | void, label?: string): void
    // Other injected services (locale, sessions, …) are available at runtime;
    // add typed members here as tokens-core starts using them.
    [service: string]: unknown
  }
}
