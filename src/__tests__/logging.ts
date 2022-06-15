import { Logging } from 'serverless/classes/Plugin';

export default {
  log: {
    error: console.error,
    warning: console.warn,
    notice: console.info,
    verbose: console.info,
    success: console.info,
    info: console.info,
    debug: console.debug,
  },

  writeText: console.log,
  progress: {
    get: () => {
      // empty function
    },
    create: () => {
      // empty function
    },
  } as unknown as Logging['progress'],
} as Logging;
