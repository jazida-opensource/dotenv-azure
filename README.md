# dotenv-azure

[![BuildStatus](https://img.shields.io/travis/motdotla/dotenv/master.svg?style=flat-square)](https://travis-ci.org/motdotla/dotenv)
[![NPM version](https://img.shields.io/npm/v/dotenv.svg?style=flat-square)](https://www.npmjs.com/package/dotenv)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)
[![Coverage Status](https://img.shields.io/coveralls/motdotla/dotenv/master.svg?style=flat-square)](https://coveralls.io/github/motdotla/dotenv?branch=coverall-intergration)
[![LICENSE](https://img.shields.io/github/license/motdotla/dotenv.svg)](LICENSE)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

Load environment variables from Azure's services [App Configuration](https://azure.microsoft.com/en-us/services/app-configuration/), [Key Vault](https://azure.microsoft.com/en-us/services/key-vault/) or a `.env` file with an api similar to [dotenv](https://github.com/motdotla/dotenv).

## Why

Maybe you want to securely store secrets in [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/), but you also have configurations and feature flags stored in [Azure App Configuration](https://azure.microsoft.com/en-us/services/app-configuration/) and you have to override some of those configurations with a `.env` file when running your app locally.

Or you have a complex configuration data that you want to centralize it somewhere. Azure recommends the usage of App Config for configuration and Key Vault for secrets. You can read more about it [here](https://docs.microsoft.com/en-us/azure/azure-app-configuration/faq).

With dotenv-azure you can easily retrieve your app's configurations and secrets from these 3 sources and merge them into `process.env`.

If you would like to know more about App Configuration and Key Vault, you may want to review [What is App Configuration?](https://docs.microsoft.com/en-us/azure/azure-app-configuration/overview) and [What is Azure Key Vault?](https://docs.microsoft.com/en-us/azure/key-vault/key-vault-overview)

## Getting started

#### Install the package

Install with npm
```bash
npm install dotenv-azure
```

or with yarn
```bash
yarn add dotenv-azure
```


#### Configuring App Configuration

1. [Create an app configuration store via Azure portal or CLI](https://docs.microsoft.com/en-us/azure/azure-app-configuration/quickstart-aspnet-core-app#create-an-app-configuration-store).
2. Set **AZURE_APP_CONFIG_URL** and **AZURE_APP_CONFIG_CONNECTION_STRING** as environment variables using bash or put them in a `.env` file:

> In production, if you are using [Azure Managed Identities](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview), you just have to set **AZURE_APP_CONFIG_URL**.

```bash
AZURE_APP_CONFIG_URL="https://your-app-config.azconfig.io"
AZURE_APP_CONFIG_CONNECTION_STRING="generated-app-config-conneciton-string"
```

#### Configuring Key Vault

If you want to use Key Vault alongside with App Configuration you have to create a service principal and configure its access to Azure resources. You can follow [this guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal).

Once you have **AZURE_CLIENT_ID**(appId), **AZURE_CLIENT_SECRET**(password) and **AZURE_TENANT_ID**(tenant) you have to set them as environment variables. You can do this with `export` in Bash or put them in a `.env` file:

> In production, if you are using [Azure Managed Identities](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview), you don't have to set these variables.

```bash
AZURE_CLIENT_ID="generated-app-ID"
AZURE_CLIENT_SECRET="random-password"
AZURE_TENANT_ID="tenant-ID"
```

If you have a configuration in Azure App Configuration with a value starting with `kv:`, `dotenv-azure` will try to load them from key vault.

Let's assume you have created a secret in Key Vault, copied the secret url and created a new configuration in App Configuration with a value of the url of your secret:
```bash
DATABASE_URL=kv:https://your.vault.azure.net/secrets/DatabaseUrl/7091540ce97143deb08790a53fc2a75d
```

After calling `.config()` method, the value of your key vault scret will be set to process.env:

```javascript
const DotenvAzure = require('dotenv-azure')

async function main () {
  await new DotenvAzure().config()
  console.log(process.env.DATABASE_URL) // prints your secret value
}

main()
```

#### Using dotenv-azure

You should call `dotenv-azure` rigth after the initialization of your app. Since the method `.config()` returns a promise, you have to call it inside an async function:
```javascript
const DotenvAzure = require('dotenv-azure')
const dotenvAzure = new DotenvAzure()

async function main () {
  const { parsed } = await dotenvAzure.config()

  // `parsed` is an object containing:
  //   - Your App Config configurations
  //   - Key Vault secrets
  //   - Environment variables defined in a .env file
  //   - and environment variables that weren't overwritten
  console.log(parsed)

  // process.env now has the keys and values from the parsed result
  console.log(process.env)
}

main()
```

## Preload

TODO

## Rules

TODO

## Options

You can pass a `safe` option to validate your variables from a `.env.example` file like [dotenv-safe](https://github.com/rolodato/dotenv-safe):

```javascript
const DotenvAzure = require('dotenv-azure')
const dotenvAzure = new DotenvAzure()

async function main () {
  await dotenvAzure.config({
    safe: true,
    allowEmptyValues: true,
    example: './.my-env-example-filename'
  })
}

main()
```

`.config()` and `.parse()` have the same options as [dotenv](https://github.com/motdotla/dotenv#options) and [dotenv-safe](https://github.com/rolodato/dotenv-safe#options)

## Documentation

You can read the api documentation [here]().

## Inspirations

- [dotenv](https://github.com/motdotla/dotenv)
- [dotenv-safe](https://github.com/rolodato/dotenv-safe)
- [dotenv-keyvault](https://github.com/martinpeck/dotenv-keyvault)

## Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind are welcome!
