import { format, inspect } from 'node:util'

export const log = {
  debug: (...args: unknown[]) => {
    if (isDebug()) {
      process.stdout.write(`DEBUG: ${format(...args)}\n`)
    }
  },
  warning: (...args: unknown[]) => {
    process.stdout.write(`WARNING: ${format(...args)}\n`)
  },
  info: (...args: unknown[]) => {
    process.stdout.write(`${format(...args)}\n`)
  },
  error: (...args: unknown[]) => {
    process.stderr.write(`ERROR: ${format(...args)}\n`)
  },
  deep: (...args: unknown[]) => {
    process.stdout.write(`${inspect({ ...args }, false, null, true)}\n`)
  },
}

export const childLogger = (name: string) => {
  const prefix = `[${name}]`
  return {
    debug: (...args: unknown[]) => log.debug(prefix, ...args),
    warning: (...args: unknown[]) => log.warning(prefix, ...args),
    info: (...args: unknown[]) => log.info(prefix, ...args),
    error: (...args: unknown[]) => log.error(prefix, ...args),
  }
}

export function isDebug() {
  return Boolean(process.env.DEBUG)
}
