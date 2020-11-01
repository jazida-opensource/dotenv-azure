# dotenv-azure

[![NPM version](https://img.shields.io/npm/v/dotenv-azure.svg)](https://www.npmjs.com/package/dotenv-azure)
![Build status](https://github.com/jazida-opensource/dotenv-azure/workflows/build/badge.svg)
[![codecov](https://codecov.io/gh/jazida-opensource/dotenv-azure/branch/master/graph/badge.svg)](https://codecov.io/gh/jazida-opensource/dotenv-azure)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](https://github.com/feross/standard)
[![LICENSE](https://img.shields.io/github/license/jazida-opensource/dotenv-azure.svg)](LICENSE)
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
2. Set **AZURE_APP_CONFIG_CONNECTION_STRING** as environment variable using bash or put them in a `.env` file:

```bash
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

If you have a configuration in App Configuration with the content type `application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8` then `dotenv-azure` will try to load it from Key Vault.

You can [add a Key Vault reference](https://docs.microsoft.com/en-us/azure/azure-app-configuration/use-key-vault-references-dotnet-core) to App Configuration in the Azure portal:

1. Sign in to the Azure portal. Select All resources, and then select the App Configuration store instance that you created in the quickstart
2. Select Configuration Explorer
3. Select + Create > Key vault reference

Now when you call the `.config()` method, the value of your key vault secret will be set to process.env:

```javascript
const { DotenvAzure } = require('dotenv-azure')

async function main() {
  await new DotenvAzure().config()
  console.log(process.env.DATABASE_URL) // prints your secret value
}

main()
```

#### Using dotenv-azure programmatically

You should call `dotenv-azure` before the initialization of your app. Since the method `.config()` returns a promise, you have to call it inside an async function:

```javascript
const { DotenvAzure } = require('dotenv-azure')

async function main() {
  const dotenvAzure = new DotenvAzure()
  const { parsed } = await dotenvAzure.config()

  // `parsed` is an object containing:
  //   - Your App Config configurations
  //   - Key Vault secrets
  //   - Environment variables defined in a .env file
  //   - and environment variables that weren't overwritten
  console.log(parsed)

  // process.env now has the keys and values from the parsed result
  console.log(process.env)

  // start app
  // ...
}

main()
```

#### Preload dotenv-azure

You can use the `--require` (`-r`) [command line option](https://nodejs.org/api/cli.html#cli_r_require_module) to preload `dotenv-azure`. By doing this, you do not need to require and load `dotenv-azure` in your application code.

```bash
node -r dotenv-azure/config your_script.js
```

To enable [safe mode](https://jazida-opensource.github.io/dotenv-azure/interfaces/dotenvazureconfigoptions.html#safe) you should require `config-safe`:

```bash
node -r dotenv-azure/config-safe your_script.js
```

## Rules

`dotenv-azure` uses `dotenv` under the covers, so the same [rules](https://github.com/motdotla/dotenv/blob/master/README.md#rules) for `.env` files apply here as well.

When populating `process.env` `dotenv-azure` will follow these steps:

1. Values within the process's environment (i.e. an environment variable exists) takes precedence over everything else.
2. For values defined in the `.env` file, and not present in the environemnt, `process.env` will be populated with those values.
3. `dotenv-azure` will search for the required environment variables to access azure's services after loading variables from the `.env` file.
4. For values defined within the process's environment, in the `.env` file or in the Azure App Configuration, where the value is prefixed with `kv:` what follows is assumed to be the secret identifier of a secret stored in Key Vault, and so `dotenv-azure` will attempt to populate the value from Key Vault.

## Options

You can pass a `safe` option to validate your variables from a `.env.example` file like [dotenv-safe](https://github.com/rolodato/dotenv-safe):

```javascript
const { DotenvAzure } = require('dotenv-azure')
const dotenvAzure = new DotenvAzure()

async function main() {
  await dotenvAzure.config({
    safe: true,
    allowEmptyValues: true,
    example: './.my-env-example-filename',
  })
}

main()
```

`.config()` and `.parse()` have the same options as [dotenv](https://github.com/motdotla/dotenv#options) and [dotenv-safe](https://github.com/rolodato/dotenv-safe#options)

## Documentation

You can read the api documentation [here](https://jazida-opensource.github.io/dotenv-azure).

## Inspirations

- [dotenv](https://github.com/motdotla/dotenv)
- [dotenv-safe](https://github.com/rolodato/dotenv-safe)
- [dotenv-keyvault](https://github.com/martinpeck/dotenv-keyvault)

## Contributors

This project follows the [all-contributors](https://github.com/kentcdodds/all-contributors) specification. Contributions of any kind are welcome!

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/danielfsousa"><img src="https://avatars0.githubusercontent.com/u/11372312?v=4" width="100px;" alt="Daniel Sousa"/><br /><sub><b>Daniel Sousa</b></sub></a><br /><a href="https://github.com/jazida-opensource/dotenv-azure/commits?author=danielfsousa" title="Code">💻</a> <a href="https://github.com/jazida-opensource/dotenv-azure/commits?author=danielfsousa" title="Documentation">📖</a> <a href="#infra-danielfsousa" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#maintenance-danielfsousa" title="Maintenance">🚧</a> <a href="https://github.com/jazida-opensource/dotenv-azure/commits?author=danielfsousa" title="Tests">⚠️</a></td>
    <td align="center"><a href="http://maheshsasidharan.github.io"><img src="https://avatars2.githubusercontent.com/u/9265496?v=4" width="100px;" alt="Mahesh Sasidharan"/><br /><sub><b>Mahesh Sasidharan</b></sub></a><br /><a href="https://github.com/jazida-opensource/dotenv-azure/commits?author=MaheshSasidharan" title="Documentation">📖</a></td>
  </tr>
</table>

<!-- ALL-CONTRIBUTORS-LIST:END -->
