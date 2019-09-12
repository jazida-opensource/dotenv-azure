import { URL } from 'url'
import dotenv, { DotenvConfigOptions, DotenvParseOptions, DotenvParseOutput } from 'dotenv'
import { DefaultAzureCredential, TokenCredential, ManagedIdentityCredential } from '@azure/identity'
import { SecretsClient } from '@azure/keyvault-secrets'
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

export interface DotenvAzureConfig {
  safe?: boolean
}

export interface DotenvAzureConfigOutput {
  dotenv: DotenvParseOutput
  azure: VariablesObject
  parsed: VariablesObject
}

export type DotenvAzureParseOutput = DotenvParseOutput

class DotenvAzure {
  private readonly safe: boolean
  private readonly keyVaultClients: { [vaultURL: string]: SecretsClient }
  private readonly azureCredential: TokenCredential

  constructor({ safe = false }: DotenvAzureConfig) {
    this.safe = safe
    this.keyVaultClients = {}
    this.azureCredential = new DefaultAzureCredential()
  }

  async config(options: DotenvConfigOptions): Promise<DotenvAzureConfigOutput> {
    const { error, parsed } = dotenv.config(options)
    if (error || !parsed) {
      throw error
    }

    const azureVars = await this.loadFromAzure(parsed)
    this.populateProcessEnv(azureVars)
    this.validateFromEnvExample()

    return {
      dotenv: parsed,
      azure: azureVars,
      parsed: { ...azureVars, ...parsed }
    }
  }

  async parse(src: string, options: DotenvParseOptions): Promise<DotenvAzureParseOutput> {
    const dotenvVars = dotenv.parse(src, options)
    const azureVars = await this.loadFromAzure(dotenvVars)
    return { ...azureVars, ...dotenvVars }
  }

  async loadFromAzure(dotenvVars: DotenvParseOutput): Promise<VariablesObject> {
    const credentials = this.getCredentials(dotenvVars)
    const appConfigClient = this.getAppConfigClient(credentials)
    const appConfigVars = await this.getVariablesFromAppConfig(appConfigClient)
    const keyVaultSecrets = await this.getSecretsFromKeyVault(appConfigVars)
    return { ...appConfigVars, ...keyVaultSecrets }
  }

  protected populateProcessEnv(variables: VariablesObject): void {
    // Add variable if does not exist in process.env
    Object.entries(variables).forEach(([key, val]) => key in process.env || (process.env[key] = val))
  }

  protected validateFromEnvExample(): void {
    // TODO:
  }

  protected async getVariablesFromAppConfig(client: AppConfigurationClient): Promise<VariablesObject> {
    let vars: VariablesObject = {}
    const request = await client.listConfigurationSettings()
    const body = request._response.parsedBody
    console.log(body)

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

  protected async getSecretsFromKeyVault(vars: VariablesObject): Promise<VariablesObject> {
    let secrets: VariablesObject = {}

    for (const [key, value] of Object.entries(vars)) {
      const keyVaultUrl = this.testIfValueIsVaultSecret(value)
      if (keyVaultUrl) {
        const baseUrl = `${keyVaultUrl.protocol}//${keyVaultUrl.hostname}`
        const [, , secretName, secretVersion] = keyVaultUrl.pathname.split('/')
        if (!secretName || !secretVersion) {
          throw new Error(`Invalid Azure Key Vault URL: ${key}`)
        }
        const res = await this.getKeyVaultClient(baseUrl).getSecret(secretName, { version: secretVersion })
        if (res.value) {
          vars[key] = res.value
        }
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

  protected getKeyVaultClient(vaultURL: string) {
    if (!this.keyVaultClients[vaultURL]) {
      this.keyVaultClients[vaultURL] = new SecretsClient(vaultURL, this.azureCredential)
    }
    return this.keyVaultClients[vaultURL]
  }

  private testIfValueIsVaultSecret(value: string): URL | undefined {
    const result = /^kv:(.+)/.exec(value)
    let keyVaultUrl
    try {
      keyVaultUrl = result ? new URL(result[1]) : undefined
    } catch {
      // noop
    }

    return keyVaultUrl
  }

  private getCredentials(dotenvVars: DotenvParseOutput): AzureCredentials {
    const vars = dotenvVars || process.env
    if (!vars.AZURE_APP_CONFIG_URL && !vars.AZURE_APP_CONFIG_URL) {
      throw new Error('Environment variable AZURE_APP_CONFIG_URL is required.')
    }

    return {
      appConfigUrl: vars.AZURE_APP_CONFIG_URL,
      appConfigConnectionString: vars.AZURE_APP_CONFIG_CONNECTION_STRING,
      tenantId: vars.AZURE_TENANT_ID,
      clientId: vars.AZURE_CLIENT_ID,
      clientSecret: vars.AZURE_CLIENT_SECRET
    }
  }
}

export { DotenvAzure, dotenv }
export default DotenvAzure
