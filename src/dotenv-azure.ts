import * as fs from 'fs'
import { URL } from 'url'
import Bottleneck from 'bottleneck'
import dotenv, { DotenvParseOptions } from 'dotenv'
import { ManagedIdentityCredential, ClientSecretCredential } from '@azure/identity'
import { SecretClient } from '@azure/keyvault-secrets'
import { AppConfigurationClient, ConfigurationSetting } from '@azure/app-configuration'
import { compact, difference, populateProcessEnv } from './utils'
import {
  MissingEnvVarsError,
  InvalidKeyVaultUrlError,
  MissingAppConfigCredentialsError,
} from './errors'
import {
  DotenvAzureOptions,
  DotenvAzureConfigOptions,
  DotenvAzureConfigOutput,
  DotenvAzureParseOutput,
  VariablesObject,
  AzureCredentials,
  AppConfigurations,
  KeyVaultReferenceInfo,
  KeyVaultReferences,
} from './types'

export default class DotenvAzure {
  private readonly keyVaultRateLimitMinTime: number
  private readonly connectionString?: string
  private readonly tenantId?: string
  private readonly clientId?: string
  private readonly clientSecret?: string
  private readonly keyVaultClients: {
    [vaultURL: string]: SecretClient
  }

  /**
   * Initializes a new instance of the DotenvAzure class.
   */
  constructor({
    rateLimit = 45,
    tenantId,
    clientId,
    clientSecret,
    connectionString,
  }: DotenvAzureOptions = {}) {
    this.keyVaultRateLimitMinTime = Math.ceil(1000 / rateLimit)
    this.connectionString = connectionString
    this.tenantId = tenantId
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.keyVaultClients = {}
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
    const vars:Record<string, string | undefined> = {...(dotenvResult.parsed || {}), ...process.env}
    const azureVars = await this.loadFromAzure(vars)
    const joinedVars = { ...azureVars, ...dotenvResult.parsed }

    populateProcessEnv(azureVars)
    if (safe) {
      this.validateFromEnvExample(options, dotenvResult.error)
    }

    return {
      parsed: joinedVars,
      dotenv: dotenvResult,
      azure: azureVars,
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
   * @param dotenvVars - dotenv parse() output containing azure credentials variables
   * @returns an object with keys and values
   */
  async loadFromAzure(dotenvVars?: Record<string, string | undefined>): Promise<VariablesObject> {
    // const vars = {...dotenvVars, ...process.env}
    const credentials = this.getAzureCredentials(dotenvVars)
    const appConfigClient = new AppConfigurationClient(credentials.connectionString)
    const labels = dotenvVars?.AZURE_APP_CONFIG_LABELS || ''
    const { appConfigVars, keyVaultReferences } = await this.getAppConfigurations(
      appConfigClient,
      labels
    )
    const keyVaultSecrets = await this.getSecretsFromKeyVault(credentials, keyVaultReferences)
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

  protected async getAppConfigurations(
    client: AppConfigurationClient,
    labels = ''
  ): Promise<AppConfigurations> {
    const appConfigVars: VariablesObject = {}
    const keyVaultReferences: KeyVaultReferences = {}

    for await (const config of client.listConfigurationSettings({ labelFilter: labels })) {
      if (this.isKeyVaultReference(config)) {
        keyVaultReferences[config.key] = this.getKeyVaultReferenceInfo(config)
      } else {
        appConfigVars[config.key] = config.value
      }
    }

    return { appConfigVars, keyVaultReferences }
  }

  protected async getSecretsFromKeyVault(
    credentials: AzureCredentials,
    vars: KeyVaultReferences
  ): Promise<VariablesObject> {
    const secrets: VariablesObject = {}
    // limit requests to avoid Azure AD rate limiting
    const limiter = new Bottleneck({ minTime: this.keyVaultRateLimitMinTime })

    const getSecret = async (key: string, info: KeyVaultReferenceInfo): Promise<void> => {
      const keyVaultClient = this.getKeyVaultClient(credentials, info.vaultUrl.href)
      const response = await keyVaultClient.getSecret(info.secretName, {
        version: info.secretVersion,
      })
      secrets[key] = response.value
    }

    const secretsPromises = Object.entries(vars).map(([key, val]) =>
      limiter.schedule(() => getSecret(key, val))
    )
    await Promise.all(secretsPromises)
    return secrets
  }

  protected getKeyVaultClient(credentials: AzureCredentials, vaultURL: string): SecretClient {
    const { tenantId, clientId, clientSecret } = credentials

    if (!this.keyVaultClients[vaultURL]) {
      if (tenantId && clientId && clientSecret) {
        this.keyVaultClients[vaultURL] = new SecretClient(
          vaultURL,
          new ClientSecretCredential(tenantId, clientId, clientSecret)
        )
      } else {
        this.keyVaultClients[vaultURL] = new SecretClient(vaultURL, new ManagedIdentityCredential())
      }
    }

    return this.keyVaultClients[vaultURL]
  }

  protected getKeyVaultReferenceInfo({ key, value }: ConfigurationSetting): KeyVaultReferenceInfo {
    try {
      const obj = value && JSON.parse(value)
      const keyVaultUrl = new URL(obj.uri)
      const [, , secretName, secretVersion] = keyVaultUrl.pathname.split('/')
      if (!secretName) {
        throw new Error('KeyVault URL does not have a secret name')
      }
      return {
        vaultUrl: new URL(keyVaultUrl.origin),
        secretUrl: keyVaultUrl,
        secretName,
        secretVersion,
      }
    } catch {
      throw new InvalidKeyVaultUrlError(key)
    }
  }

  protected isKeyVaultReference(config: ConfigurationSetting): boolean {
    return (
      config.contentType === 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8'
    )
  }

  private getAzureCredentials(dotenvVars: Record<string, string | undefined> = {}): AzureCredentials {
    const vars = { ...dotenvVars, ...process.env }
    const connectionString = this.connectionString || vars.AZURE_APP_CONFIG_CONNECTION_STRING
    
    if (!connectionString) {
      throw new MissingAppConfigCredentialsError()
    }

    return {
      connectionString,
      tenantId: this.tenantId || vars.AZURE_TENANT_ID,
      clientId: this.clientId || vars.AZURE_CLIENT_ID,
      clientSecret: this.clientSecret || vars.AZURE_CLIENT_SECRET,
    }
  }
}

export { dotenv, DotenvAzure }
