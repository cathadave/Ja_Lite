import type { ParsedAction } from '@/lib/types'

export function rebuildSummary(action: ParsedAction): string {
  const proj = action.project_name || 'unknown project'
  const task = action.task_name || 'unknown task'
  const who = action.contact_name || 'all affected contacts'
  const when =
    action.new_date ||
    (action.date_shift ? `+${action.date_shift} day(s)` : 'unspecified date')

  if (action.intent === 'reschedule_task') {
    return `Reschedule '${task}' on ${proj} to ${when}.`
  }

  if (action.intent === 'notify_contacts') {
    const ch = action.channel ? ` via ${action.channel}` : ''
    const target = action.notify_affected ? 'all affected contacts' : who
    return `Notify ${target}${ch} about changes to ${proj}.`
  }

  if (action.intent === 'reassign_task') {
    return `Reassign '${task}' on ${proj} to ${who} on ${when}.`
  }

  if (action.intent === 'create_project') {
    const tpl = action.template_name ? ` using ${action.template_name}` : ''
    return `Create new project '${proj}'${tpl}.`
  }

  if (action.intent === 'query_schedule') {
    return `Show schedule for ${proj}.`
  }

  if (action.intent === 'complete_task') {
    return `Mark '${task}' on ${proj} as completed.`
  }

  return action.summary
}

/**
 * Builds a professional outbound notification message from action data.
 *
 * rescheduleContext is an optional sibling reschedule_task action from the same
 * command. When present, its task_name and new_date are used to populate the
 * message body even if those fields are absent on the notify action itself
 * (common in compound commands like "reschedule X and notify all contacts").
 *
 * The caller's extracted message text (if any) is preserved as the
 * "Update:" detail line so user intent is never silently discarded.
 *
 * overrideReason is included when the reschedule action has a non-business-day
 * override approved. Pass undefined to omit the line entirely.
 */
export function composeNotifyMessage(
  action: ParsedAction,
  rescheduleContext?: ParsedAction,
  overrideReason?: string,
): string {
  const project = action.project_name
  const task = action.task_name ?? rescheduleContext?.task_name ?? null
  const newDate = action.new_date ?? rescheduleContext?.new_date ?? null
  const dateShift = action.date_shift ?? rescheduleContext?.date_shift ?? null
  const userDetail = (action.message ?? '').trim()

  const lines: string[] = []

  const firstName = action.contact_name
    ? action.contact_name.split(' ')[0]
    : 'Team'
  const projectLabel = project ?? 'this project'

  lines.push(
    `${firstName}, please review the update for ${projectLabel} and confirm receipt.`,
  )

  if (task && newDate) {
    lines.push(`${task} has been moved to ${newDate}.`)
  } else if (task && dateShift) {
    const days = Math.abs(dateShift)
    const dir = dateShift >= 0 ? 'forward' : 'back'
    lines.push(`${task} has been shifted ${dir} by ${days} day${days !== 1 ? 's' : ''}.`)
  } else if (task) {
    lines.push(`${task} on ${projectLabel} has been updated.`)
  } else if (newDate) {
    lines.push(`A scheduled task has been moved to ${newDate}.`)
  }

  if (userDetail) {
    lines.push(`Update: ${userDetail}`)
  }

  if (overrideReason) {
    lines.push(`Reason for schedule change: ${overrideReason}`)
  }

  lines.push('Please confirm availability of your crews.')

  return lines.join('\n')
}
