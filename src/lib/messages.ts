import type { OrganizeResult, Scope } from './types.ts'
import type { Summary } from './organizer.ts'

export type Request =
  | { type: 'ORGANIZE_NOW'; scope?: Scope }
  | { type: 'UNGROUP_ALL'; scope?: Scope }
  | { type: 'SUMMARY'; scope?: Scope }

export interface ResponseMap {
  ORGANIZE_NOW: OrganizeResult
  UNGROUP_ALL: { tabsUngrouped: number }
  SUMMARY: Summary
}

/** Typed wrapper so callers get the right response shape for each request. */
export function sendMessage<T extends Request>(request: T): Promise<ResponseMap[T['type']]> {
  return chrome.runtime.sendMessage(request) as Promise<ResponseMap[T['type']]>
}
