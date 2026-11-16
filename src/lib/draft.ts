import { isValidRule } from './matching.ts'
import type { Group } from './types.ts'

/**
 * Why a new group cannot be saved yet, or `null` when it can. A group with no
 * name or no usable rule would never match anything, so it is not created.
 */
export function draftProblem(group: Group): string | null {
  if (!group.name.trim()) return 'Give the group a name.'
  const filled = group.rules.filter((rule) => rule.value.trim())
  if (filled.length === 0) return 'Add at least one rule.'
  if (filled.some((rule) => !isValidRule(rule))) return 'Fix the rule marked in red.'
  return null
}

/** The group as it should be stored: a trimmed name and no blank rule rows left over. */
export const finalizeDraft = (group: Group): Group => ({
  ...group,
  name: group.name.trim(),
  rules: group.rules.filter((rule) => rule.value.trim()),
})
