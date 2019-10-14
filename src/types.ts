import { DotenvConfigOptions, DotenvConfigOutput } from 'dotenv'

export interface AzureCredentials {
  appConfigUrl?: string
  appConfigConnectionString?: string
  clientId?: string
  clientSecret?: string
  tenantId?: string
}

/**
 * An object with keys and values
 */
export type VariablesObject = {
  [name: string]: string
}

export interface DotenvAzureOptions {
  /**
   * You can pass the url of the App Configuration intstead of the environment variable AZURE_APP_CONFIG_URL
   */
  appConfigUrl?: string
  /**
   * Number of requests per second to avoid Azure AD rate limiter. Default: 48
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
