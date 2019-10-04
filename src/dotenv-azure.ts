import * as fs from 'fs'
import pLimit from 'p-limit'
import dotenv, { DotenvParseOptions } from 'dotenv'
import { ManagedIdentityCredential, ClientSecretCredential } from '@azure/identity'
import { SecretsClient } from '@azure/keyvault-secrets'
import { AppConfigurationClient, ModelConfigurationSetting } from '@azure/app-configuration'
import { testIfValueIsVaultSecret, compact, difference, populateProcessEnv } from './utils'
import { MissingEnvVarsError, InvalidKeyVaultUrlError, MissingAppConfigCredentialsError } from './errors'
import {
  DotenvAzureOptions,
  DotenvAzureConfigOptions,
  DotenvAzureConfigOutput,
  DotenvAzureParseOutput,
  VariablesObject,
  AzureCredentials
} from './types'

export default class DotenvAzure {
  private readonly appConfigUrl?: string
  private readonly keyVaultClients: {
    [vaultURL: string]: SecretsClient
  }

  /**
   * Initializes a new instance of the DotenvAzure class.
   */
  constructor({ appConfigUrl }: DotenvAzureOptions = {}) {
    this.keyVaultClients = {}
    this.appConfigUrl = appConfigUrl
  }

  /**
   * Loads Azure App Configuration and Key Vault variables
   * and `.env` file contents into {@link https://nodejs.org/api/process.html#process_process_env | `process.env`}.
   * Example: 'KEY=value' becomes { parsed: { KEY: 'value' } }
   * @param options - controls behavior
   */
  async config(options: DotenvAzureConfigOptions = {}): Promise<DotenvAzureConfigOutput> {
    const { safe = false } = options
    const dotenvResult = dotenv.config(options)

    const azureVars = await this.loadFromAzure(dotenvResult.parsed)
    const joinedVars = { ...azureVars, ...dotenvResult.parsed }

    populateProcessEnv(azureVars)
    if (safe) {
      this.validateFromEnvExample(options, dotenvResult.error)
    }

    return {
      parsed: joinedVars,
      dotenv: dotenvResult,
      azure: azureVars
    }
  }

  /**
   * Parses a string or buffer in the .env file format into an object
   * and merges it with your Azure App Configuration and Key Vault variables.
   * It does not change {@link https://nodejs.org/api/process.html#process_process_env | `process.env`}.
   * @param src - contents to be parsed
   * @param options - additional options
   * @returns an object with keys and values
   */
  async parse(src: string, options?: DotenvParseOptions): Promise<DotenvAzureParseOutput> {
    const dotenvVars = dotenv.parse(src, options)
    const azureVars = await this.loadFromAzure(dotenvVars)
    return { ...azureVars, ...dotenvVars }
  }

  /**
   * Loads your Azure App Configuration and Key Vault variables.
   * It does not change {@link https://nodejs.org/api/process.html#process_process_env | `process.env`}.
   * @param vars - an optional object with azure creadentials variables
   * @returns an object with keys and values
   */
  async loadFromAzure(vars?: VariablesObject): Promise<VariablesObject> {
    const credentials = this.getAuthVariables(vars)
    const appConfigClient = this.getAppConfigClient(credentials)
    const appConfigVars = await this.getVariablesFromAppConfig(appConfigClient)
    const keyVaultSecrets = await this.getSecretsFromKeyVault(credentials, appConfigVars)
    return { ...appConfigVars, ...keyVaultSecrets }
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
          (acc, item: ModelConfigurationSetting) => ({
            ...acc,
            [item.key || Symbol('key')]: item.value || ''
          }),
          {} as VariablesObject
        )
    }
    console.log('appconfig', vars)
    return vars
  }

  protected async getSecretsFromKeyVault(
    credentials: AzureCredentials,
    vars: VariablesObject
  ): Promise<VariablesObject> {
    const secrets: VariablesObject = {}
    // limit requests to avoid Azure AD rate limiting
    const limit = pLimit(2)

    const getSecret = async (key: string, value: string): Promise<void> => {
      const keyVaultUrl = testIfValueIsVaultSecret(value)
      if (!keyVaultUrl) return

      const [, , secretName, secretVersion] = keyVaultUrl.pathname.split('/')
      if (!secretName || !secretVersion) {
        throw new InvalidKeyVaultUrlError(key.replace('kv:', ''))
      }

      const keyVaultClient = this.getKeyVaultClient(credentials, keyVaultUrl.origin)
      const response = await keyVaultClient.getSecret(secretName, { version: secretVersion })
      secrets[key] = response.value || ''
      console.log('kv', secretName, response.value)
    }

    await Promise.all(Object.entries(vars).map(([key, val]) => limit(() => getSecret(key, val))))

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

  protected getKeyVaultClient(credentials: AzureCredentials, vaultURL: string): SecretsClient {
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

  private getAuthVariables(dotenvVars: VariablesObject = {}): AzureCredentials {
    const vars = { ...dotenvVars, ...process.env }
    if (!vars.AZURE_APP_CONFIG_URL && !vars.AZURE_APP_CONFIG_CONNECTION_STRING && !this.appConfigUrl) {
      throw new MissingAppConfigCredentialsError()
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

export { dotenv, DotenvAzure }
