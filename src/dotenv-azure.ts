import * as fs from 'fs'
import dotenv, { DotenvConfigOptions, DotenvParseOptions, DotenvParseOutput } from 'dotenv'
import { ManagedIdentityCredential, ClientSecretCredential } from '@azure/identity'
import { SecretsClient } from '@azure/keyvault-secrets'
import { testIfValueIsVaultSecret, compact, difference } from './utils'
import { MissingEnvVarsError, InvalidKeyVaultUrlError } from './errors'

// @azure/app-config is not published at npm yet
import { AppConfigurationClient } from './app-config'
import { ConfigurationSetting } from './app-config/generated/models'

export type VariablesObject = { [name: string]: string }

export interface AzureCredentials {
  appConfigUrl?: string
  appConfigConnectionString?: string
  clientId?: string
  clientSecret?: string
  tenantId?: string
}

export interface DotenvAzureOptions {
  appConfigUrl?: string
}

export interface DotenvAzureConfigOptions extends DotenvConfigOptions {
  safe?: boolean
  allowEmptyValues?: boolean
  example?: string
}

export interface DotenvAzureConfigOutput {
  dotenv: DotenvParseOutput
  azure: VariablesObject
  parsed: VariablesObject
}

export type DotenvAzureParseOutput = DotenvParseOutput

export default class DotenvAzure {
  private readonly appConfigUrl?: string
  private readonly keyVaultClients: { [vaultURL: string]: SecretsClient }

  constructor({ appConfigUrl }: DotenvAzureOptions = {}) {
    this.keyVaultClients = {}
    this.appConfigUrl = appConfigUrl
  }

  async config(options: DotenvAzureConfigOptions = {}): Promise<DotenvAzureConfigOutput> {
    const { safe = false } = options
    const { error, parsed } = dotenv.config(options)
    if (error || !parsed) {
      throw error
    }

    const azureVars = await this.loadFromAzure(parsed)
    const joinedVars = { ...azureVars, ...parsed }

    this.populateProcessEnv(azureVars)
    if (safe) {
      this.validateFromEnvExample(options, error)
    }

    return {
      parsed: joinedVars,
      dotenv: parsed,
      azure: azureVars
    }
  }

  async parse(src: string, options: DotenvParseOptions): Promise<DotenvAzureParseOutput> {
    const dotenvVars = dotenv.parse(src, options)
    const azureVars = await this.loadFromAzure(dotenvVars)
    return { ...azureVars, ...dotenvVars }
  }

  async loadFromAzure(dotenvVars: DotenvParseOutput): Promise<VariablesObject> {
    const credentials = this.getAuthVariables(dotenvVars)
    const appConfigClient = this.getAppConfigClient(credentials)
    const appConfigVars = await this.getVariablesFromAppConfig(appConfigClient)
    const keyVaultSecrets = await this.getSecretsFromKeyVault(credentials, appConfigVars)
    return { ...appConfigVars, ...keyVaultSecrets }
  }

  protected populateProcessEnv(variables: VariablesObject): void {
    // Add variable if does not exist in process.env
    Object.entries(variables).forEach(([key, val]) => key in process.env || (process.env[key] = val))
  }

  protected validateFromEnvExample(options: DotenvAzureConfigOptions, dotenvError?: Error): void {
    const { allowEmptyValues = false, example = '.env.example', path = '.env' } = options
    const processEnv = allowEmptyValues ? process.env : compact(process.env)
    const exampleVars = dotenv.parse(fs.readFileSync(example))
    const missing = difference(Object.keys(exampleVars), Object.keys(processEnv))
    if (missing.length > 0) {
      throw new MissingEnvVarsError(allowEmptyValues, path, example, missing, dotenvError)
    }
  }

  protected async getVariablesFromAppConfig(client: AppConfigurationClient): Promise<VariablesObject> {
    let vars: VariablesObject = {}
    const request = await client.listConfigurationSettings()
    const body = request._response.parsedBody

    if (body.items) {
      vars = body.items
        .filter(item => item.key)
        .reduce(
          (acc, item: ConfigurationSetting) => ({
            ...acc,
            [item.key || Symbol()]: item.value || ''
          }),
          {} as VariablesObject
        )
    }

    return vars
  }

  protected async getSecretsFromKeyVault(
    credentials: AzureCredentials,
    vars: VariablesObject
  ): Promise<VariablesObject> {
    let secrets: VariablesObject = {}

    for (const [key, value] of Object.entries(vars)) {
      const keyVaultUrl = testIfValueIsVaultSecret(value)
      if (keyVaultUrl) {
        const [, , secretName, secretVersion] = keyVaultUrl.pathname.split('/')
        if (!secretName || !secretVersion) {
          throw new InvalidKeyVaultUrlError(key.replace('kv:', ''))
        }
        const keyVaultClient = this.getKeyVaultClient(credentials, keyVaultUrl.origin)
        const response = await keyVaultClient.getSecret(secretName, { version: secretVersion })
        secrets[key] = response.value || ''
      }
    }

    return secrets
  }

  protected getAppConfigClient(credentials: AzureCredentials): AppConfigurationClient {
    const { appConfigUrl = '', appConfigConnectionString } = credentials
    if (appConfigConnectionString) {
      return new AppConfigurationClient(appConfigConnectionString)
    } else {
      return new AppConfigurationClient(appConfigUrl, new ManagedIdentityCredential())
    }
  }

  protected getKeyVaultClient(credentials: AzureCredentials, vaultURL: string) {
    const { tenantId, clientId, clientSecret } = credentials

    if (!this.keyVaultClients[vaultURL]) {
      if (tenantId && clientId && clientSecret) {
        this.keyVaultClients[vaultURL] = new SecretsClient(
          vaultURL,
          new ClientSecretCredential(tenantId, clientId, clientSecret)
        )
      } else {
        this.keyVaultClients[vaultURL] = new SecretsClient(vaultURL, new ManagedIdentityCredential())
      }
    }

    return this.keyVaultClients[vaultURL]
  }

  private getAuthVariables(dotenvVars: DotenvParseOutput): AzureCredentials {
    const vars = dotenvVars || process.env
    if (!vars.AZURE_APP_CONFIG_URL && !vars.AZURE_APP_CONFIG_CONNECTION_STRING && !this.appConfigUrl) {
      throw new Error(
        'At least one of the variables AZURE_APP_CONFIG_URL or AZURE_APP_CONFIG_CONNECTION_STRING is required. \
        You can also pass the option `appConfigUrl` to the DotenvAzure constructor'
      )
    }

    return {
      appConfigUrl: this.appConfigUrl || vars.AZURE_APP_CONFIG_URL,
      appConfigConnectionString: vars.AZURE_APP_CONFIG_CONNECTION_STRING,
      tenantId: vars.AZURE_TENANT_ID,
      clientId: vars.AZURE_CLIENT_ID,
      clientSecret: vars.AZURE_CLIENT_SECRET
    }
  }
}

export { dotenv, DotenvAzure, MissingEnvVarsError, InvalidKeyVaultUrlError as InvalidKeyVaultUrl }
