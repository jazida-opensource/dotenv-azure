import { URL } from 'url'
import { DotenvConfigOptions, DotenvConfigOutput } from 'dotenv'

export interface AzureCredentials {
  connectionString: string
  clientId?: string
  clientSecret?: string
  tenantId?: string
}

/**
 * An object with keys and values
 */
export type VariablesObject = {
  [key: string]: string | undefined
}

export interface AppConfigurations {
  appConfigVars: VariablesObject
  keyVaultReferences: KeyVaultReferences
}

export interface KeyVaultReferenceInfo {
  vaultUrl: URL
  secretUrl: URL
  secretName: string
  secretVersion?: string
}

export interface KeyVaultReferences {
  [key: string]: KeyVaultReferenceInfo
}

export interface DotenvAzureOptions {
  /**
   * You can pass the connection string of the App Configuration
   * intstead of the environment variable AZURE_APP_CONFIG_CONNECTION_STRING
   */
  connectionString?: string
  /**
   * You can pass the id of the principal's Azure Active Directory tenant
   * intstead of the environment variable AZURE_TENANT_ID
   */
  tenantId?: string
  /**
   * You can pass the service principal's app id
   * intstead of the environment variable AZURE_CLIENT_ID
   */
  clientId?: string
  /**
   * You can pass one of the service principal's client secrets
   * intstead of the environment variable AZURE_CLIENT_SECRET
   */
  clientSecret?: string
  /**
   * Number of requests per second to avoid Azure AD rate limiter. Default: 45
   */
  rateLimit?: number
}

export interface DotenvAzureConfigOptions extends DotenvConfigOptions {
  /**
   * Validates your environment variables against a `.env.example` file
   */
  safe?: boolean

  /**
   * If a variable is defined in the example file and has an empty value in the environment,
   * enabling this option will not throw an error after loading. Defaults to `false`.
   */
  allowEmptyValues?: boolean

  /**
   * Path to example environment file. Defaults to `.env.example`.
   */
  example?: string
}

export interface DotenvAzureConfigOutput {
  /**
   * The result of dotenv.config()
   */
  dotenv: DotenvConfigOutput

  /**
   * Variables from Azure App Configuration and Key Vault
   */
  azure: VariablesObject

  /**
   * Merged variables from Azure App Configuration, Key Vault variables and `.env` file
   */
  parsed: VariablesObject
}

export type DotenvAzureParseOutput = VariablesObject
