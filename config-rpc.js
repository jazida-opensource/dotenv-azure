const { DotenvAzure } = require('./dist/lib/dotenv-azure')
const { APP_CONFIG_CONNECTION_STRING } = process.env

module.exports = function config() {
  return options => new DotenvAzure(APP_CONFIG_CONNECTION_STRING).config(options)
}
