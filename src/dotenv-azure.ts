import * as fs from 'fs'
import dotenv, { DotenvParseOptions } from 'dotenv'
import { AppConfigurationClient } from '@azure/app-configuration'
import { compact, difference, populateProcessEnv } from './utils'
import { MissingEnvVarsError, MissingAppConfigCredentialsError } from './errors'
import { DotenvAzureConfigOptions, DotenvAzureConfigOutput, DotenvAzureParseOutput, VariablesObject } from './types'

export default class DotenvAzure {
  private readonly connectionString?: string

  /**
   * Initializes a new instance of the DotenvAzure class.
   */
  constructor(connectionString?: string) {
    this.connectionString = connectionString
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
    const connectionString = dotenvResult.parsed && dotenvResult.parsed.AZURE_APP_CONFIG_CONNECTION_STRING
    const azureVars = await this.loadAllFromAppConfig(connectionString)
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
   * and merges it with your Azure App Configuration variables.
   * It does not change {@link https://nodejs.org/api/process.html#process_process_env | `process.env`}.
   * @param src - contents to be parsed
   * @param options - additional options
   * @returns an object with keys and values
   */
  async parse(src: string, options?: DotenvParseOptions): Promise<DotenvAzureParseOutput> {
    const dotenvVars = dotenv.parse(src, options)
    const connectionString = dotenvVars && dotenvVars.AZURE_APP_CONFIG_CONNECTION_STRING
    const azureVars = await this.loadAllFromAppConfig(connectionString)
    return { ...azureVars, ...dotenvVars }
  }

  /**
   * Loads all your Azure App Configuration variables into a key-value object.
   * It does not change {@link https://nodejs.org/api/process.html#process_process_env | `process.env`}.
   * @param connectionString - Azure App Configuration connection string
   * @returns an object with keys and values
   */
  async loadAllFromAppConfig(connectionString?: string): Promise<VariablesObject> {
    const client = this.getAppConfigClient(connectionString)
    const vars: VariablesObject = {}

    for await (const config of client.listConfigurationSettings()) {
      vars[config.key] = config.value
    }

    return vars
  }

  private getAppConfigClient(connectionString?: string): AppConfigurationClient {
    const authentication = this.connectionString || process.env.AZURE_APP_CONFIG_CONNECTION_STRING || connectionString
    if (!authentication) {
      throw new MissingAppConfigCredentialsError()
    }

    return new AppConfigurationClient(authentication)
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
}

export { DotenvAzure, AppConfigurationClient, dotenv }
