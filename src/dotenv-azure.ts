// Import here Polyfills if needed. Recommended core-js (npm i -D core-js)
// import "core-js/fn/array.find"
// ...
import dotenv, {
  DotenvConfigOptions,
  DotenvParseOptions,
  DotenvConfigOutput,
  DotenvParseOutput
} from 'dotenv'
import {
  ClientSecretCredential,
  ManagedIdentityCredential,
  ChainedTokenCredential
} from '@azure/identity'
import { SecretsClient } from '@azure/keyvault-secrets'
import { AppConfigurationManagementClient } from '@azure/arm-appconfiguration'
import * as msRestNodeAuth from '@azure/ms-rest-nodeauth'
import { ServiceClientCredentials } from '@azure/ms-rest-js'
import { ConfigurationStoresListResponse } from '@azure/arm-appconfiguration/esm/models'

export type VariablesObject = { [name: string]: string }

export interface AzureClientSecretCredentials {
  clientId?: string
  clientSecret?: string
  tenantId?: string
}

export interface AppConfigCredentials extends AzureClientSecretCredentials {
  subscriptionId: string
}

export interface KeyVaultCredentials extends AzureClientSecretCredentials {
  vaultName: string
}

export interface DotenvAzureConfig {
  safe: boolean
  appConfig: AppConfigCredentials
  keyVault: KeyVaultCredentials
}

export { dotenv }

export default class DotenvAzure {
  credentials: {
    appConfig: AppConfigCredentials
    keyVault: KeyVaultCredentials
  }

  constructor({ appConfig, keyVault }: DotenvAzureConfig) {
    this.credentials = { appConfig, keyVault }
  }

  async config(options: DotenvConfigOptions): Promise<DotenvConfigOutput> {
    try {
      const dotenvOutput = dotenv.config(options)
      if (dotenvOutput.error) {
        throw dotenvOutput.error
      }

      const azureVars = await this.loadFromAzure()
      this.populateProcessEnv(azureVars)
      this.validateFromEnvExample()

      return {
        parsed: { ...azureVars, ...dotenvOutput.parsed }
      }
    } catch (error) {
      return { error }
    }
  }

  async parse(src: string, options: DotenvParseOptions): Promise<DotenvParseOutput> {
    const dotenvVars = dotenv.parse(src, options)
    const azureVars = await this.loadFromAzure()
    return { ...azureVars, ...dotenvVars }
  }

  async loadFromAzure(): Promise<VariablesObject> {
    let secrets: VariablesObject = {}

    const keyVaultClient = this.buildKeyVaultClient()
    const appConfigClient = await this.buildAppConfigClient()

    let nextLink
    do {
      const response: ConfigurationStoresListResponse = nextLink
        ? await appConfigClient.configurationStores.listNext(nextLink)
        : await appConfigClient.configurationStores.list()

      console.log(response._response.parsedBody)
      nextLink = response.nextLink
    } while (nextLink)

    for (const [key, value] of Object.entries(secrets)) {
      if (value.startsWith('kv:')) {
        delete secrets[key]
        const keyvaultURL = value.replace('kv:', '')
        const res = await keyVaultClient.getSecret(keyvaultURL)
        if (res.value) {
          secrets[key] = res.value
        }
      }
    }

    return secrets
  }

  protected populateProcessEnv(variables: VariablesObject): void {
    // Add if variable does not exist in process.env
    Object.entries(variables).forEach(
      ([key, val]) => key in process.env || (process.env[key] = val)
    )
  }

  protected validateFromEnvExample(): void {
    // TODO:
  }

  protected buildKeyVaultClient(): SecretsClient {
    const { vaultName, tenantId = '', clientId = '', clientSecret = '' } = this.credentials.keyVault
    const managedIdentityCreds = new ManagedIdentityCredential()
    const servicePrincipalCreds = new ClientSecretCredential(tenantId, clientId, clientSecret)
    const credentialChain = new ChainedTokenCredential(managedIdentityCreds, servicePrincipalCreds)
    const url = `https://${vaultName}.vault.azure.net`
    return new SecretsClient(url, credentialChain)
  }

  protected async buildAppConfigClient(): Promise<AppConfigurationManagementClient> {
    const {
      subscriptionId,
      clientId = '',
      clientSecret = '',
      tenantId = ''
    } = this.credentials.appConfig

    let creds: ServiceClientCredentials
    try {
      creds = await msRestNodeAuth.loginWithVmMSI()
    } catch {
      creds = await msRestNodeAuth.loginWithServicePrincipalSecret(clientId, clientSecret, tenantId)
    }

    return new AppConfigurationManagementClient(creds, subscriptionId)
  }
}
