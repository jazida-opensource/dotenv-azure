const forceSync = require('sync-rpc')
const { populateProcessEnv } = require('./dist/lib/utils')
const configSync = forceSync(require.resolve('./config-rpc'))

try {
  const { parsed } = configSync()
  populateProcessEnv(parsed)
} catch {
  // noop
}
