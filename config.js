const forceSync = require('sync-rpc')
const { populateProcessEnv } = require('./dist/lib/utils')
const configSync = forceSync(require.resolve('./config-rpc'))

const { parsed } = configSync()
populateProcessEnv(parsed)
