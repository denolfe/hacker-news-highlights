const TIME_ZONE = 'America/New_York'

/**
 * `M.D.YY` key identifying an episode's Eastern calendar day, e.g. `8.30.26`.
 *
 * Prefixes every episode title and doubles as the one-episode-per-day
 * idempotency key, so it must stay in the same zone as the release time.
 */
export function getEpisodeDatePrefix(now: Date = new Date()): string {
  return now
    .toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
      timeZone: TIME_ZONE,
    })
    .split('/')
    .join('.')
}

/** Separator between the date key and the summary portion of an episode title. */
export const EPISODE_TITLE_SEPARATOR = ' | '
