const TIME_ZONE = 'America/New_York'
const PUBLISH_HOUR = 6
const PUBLISH_MINUTE = 30

/**
 * UTC instant of "today 6:30am America/New_York" for the Eastern calendar
 * date of `now`. DST-aware; episodes release at a consistent local time.
 */
export function getScheduledPublishTime(now: Date = new Date()): Date {
  // en-CA formats as YYYY-MM-DD
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(now)
    .split('-')
    .map(Number)

  // Two-pass: guess the wall clock as UTC, then correct by the zone offset
  // at that instant (re-resolved once so DST-transition days converge)
  const wallClockAsUtc = Date.UTC(year, month - 1, day, PUBLISH_HOUR, PUBLISH_MINUTE)
  let offsetMs = timeZoneOffsetMs(new Date(wallClockAsUtc))
  offsetMs = timeZoneOffsetMs(new Date(wallClockAsUtc - offsetMs))
  return new Date(wallClockAsUtc - offsetMs)
}

/** Offset of TIME_ZONE from UTC at `date` (negative for US Eastern). */
function timeZoneOffsetMs(date: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .map(p => [p.type, p.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - date.getTime()
}
