const { DotenvAzure } = require('./dist/lib/dotenv-azure')

module.exports = function config() {
  return options => new DotenvAzure().config(options)
}
