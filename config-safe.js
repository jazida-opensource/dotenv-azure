const forceSync = require('sync-rpc')
const { populateProcessEnv } = require('./dist/lib/utils')
const configSync = forceSync(require.resolve('./config-rpc'))

const { parsed } = configSync({
  safe: true,
  allowEmptyValues: true,
})

populateProcessEnv(parsed)
