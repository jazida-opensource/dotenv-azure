import { DotenvConfigOptions, DotenvConfigOutput } from 'dotenv'

/**
 * An object with keys and values
 */
export type VariablesObject = {
  [key: string]: string | undefined
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
   * Merged variables from Azure App Configuration and `.env` file
   */
  parsed: VariablesObject
}

export type DotenvAzureParseOutput = VariablesObject
