import { appConfigListMock, mockAppConfigListResponse } from './azure.mock'
import DotenvAzure from '../src/dotenv-azure'
import { readFileSync } from 'fs'
import { MissingAppConfigCredentialsError, InvalidKeyVaultUrlError, MissingEnvVarsError } from '../src/errors'

const dotEnvVarsFileContent = 'DOTENV_VAR=ok'
const dotenvVars = { DOTENV_VAR: 'ok' }
const appConfigVars = { APP_CONFIG_VAR: 'ok' }
const keyVaultVars = { KEY_VAULT_VAR: 'ok' }
const azureVars = { ...appConfigVars, ...keyVaultVars }

jest.mock('fs')
const mockReadFileSync = readFileSync as jest.Mock

describe('DotenvAzure', () => {
  const OLD_ENV = process.env
  const AZURE_APP_CONFIG_URL = 'https://test.azconfig.io'
  const AZURE_APP_CONFIG_CONNECTION_STRING = 'app-config-conneciton-string'
  const AZURE_TENANT_ID = 'tenant-id'
  const AZURE_CLIENT_ID = 'client-id'
  const AZURE_CLIENT_SECRET = 'client-secret'
  const dotenvAzure = new DotenvAzure({
    appConfigUrl: AZURE_APP_CONFIG_URL
  })

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
    mockReadFileSync.mockReturnValue(dotEnvVarsFileContent)
  })

  afterEach(() => {
    jest.clearAllMocks()
    process.env = OLD_ENV
  })

  describe('config()', () => {
    it('does not throw when AZURE_APP_CONFIG_URL is defined', async () => {
      process.env = { ...OLD_ENV, AZURE_APP_CONFIG_URL }
      const dotenvAzure = new DotenvAzure()
      expect(await dotenvAzure.config()).toBeDefined()
    })

    it('does not throw when AZURE_APP_CONFIG_CONNECTION_STRING is defined', async () => {
      process.env = { ...OLD_ENV, AZURE_APP_CONFIG_CONNECTION_STRING }
      const dotenvAzure = new DotenvAzure()
      expect(await dotenvAzure.config()).toBeDefined()
    })

    it('throws when AZURE_APP_CONFIG_URL and AZURE_APP_CONFIG_CONNECTION_STRING are not defined', () => {
      const dotenvAzure = new DotenvAzure()
      expect(dotenvAzure.config()).rejects.toThrowError(MissingAppConfigCredentialsError)
    })

    it('returns KeyVault variables when AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET are defined', async () => {
      process.env = {
        ...OLD_ENV,
        AZURE_APP_CONFIG_CONNECTION_STRING,
        AZURE_TENANT_ID,
        AZURE_CLIENT_ID,
        AZURE_CLIENT_SECRET
      }
      const dotenvAzure = new DotenvAzure()
      const { azure } = await dotenvAzure.config()
      expect(azure).toEqual(azureVars)
    })

    it('ignores variables with `kv:` prefix that does not have a valid url', async () => {
      appConfigListMock.mockReturnValueOnce(
        mockAppConfigListResponse([
          {
            key: 'APP_CONFIG_VAR',
            value: 'ok'
          },
          {
            key: 'KEY_VAULT_VAR',
            value: 'kv:invalid_url'
          },
          {
            key: 'KEY_VAULT_VAR_2',
            value: 'kv:another_invalid_url'
          }
        ])
      )

      const { parsed } = await dotenvAzure.config()

      expect(parsed).toEqual({
        ...dotenvVars,
        ...appConfigVars,
        KEY_VAULT_VAR: 'kv:invalid_url',
        KEY_VAULT_VAR_2: 'kv:another_invalid_url'
      })
    })

    it('throws when variables with `kv:` prefix have an invalid KeyVault url', () => {
      appConfigListMock.mockReturnValueOnce(
        mockAppConfigListResponse([
          {
            key: 'APP_CONFIG_VAR',
            value: 'ok'
          },
          {
            key: 'KEY_VAULT_VAR',
            value: 'kv:https://key.vault.azure.net/secrets/DatabaseUrl'
          }
        ])
      )

      expect(dotenvAzure.config()).rejects.toThrowError(InvalidKeyVaultUrlError)
    })

    it('returns dotenv undefined when .env file does not exist', async () => {
      process.env = { ...OLD_ENV, AZURE_APP_CONFIG_CONNECTION_STRING }
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File not found')
      })

      const dotenvAzure = new DotenvAzure()
      const { parsed, dotenv } = await dotenvAzure.config()

      expect(parsed).toEqual(azureVars)
      expect(dotenv.parsed).toBeUndefined()
      expect(dotenv.error).toBeInstanceOf(Error)
    })

    it('returns parsed object with AppConfig, KeyVault and .env variables', async () => {
      const { parsed, dotenv, azure } = await dotenvAzure.config()
      expect(mockReadFileSync).toBeCalled()
      expect(dotenv.parsed).toEqual(dotenvVars)
      expect(azure).toEqual(azureVars)
      expect(parsed).toEqual({ ...azureVars, ...dotenvVars })
    })

    it('populates process.env with AppConfig, KeyVault and .env variables', async () => {
      await dotenvAzure.config()
      expect(mockReadFileSync).toBeCalled()
      expect(process.env.DOTENV_VAR).toBe('ok')
      expect(process.env.KEY_VAULT_VAR).toBe('ok')
      expect(process.env.APP_CONFIG_VAR).toBe('ok')
    })

    it('.env file takes precedence over azure variables', async () => {
      mockReadFileSync.mockReturnValue(`
        DATABASE_URL=from_dotenv
        PASSWORD=from_dotenv
      `)

      appConfigListMock.mockReturnValueOnce(
        mockAppConfigListResponse([
          {
            key: 'DATABASE_URL',
            value: 'from_appconfig'
          },
          {
            key: 'PASSWORD',
            value: 'from_appconfig'
          }
        ])
      )

      const { parsed } = await dotenvAzure.config()
      expect(process.env.DATABASE_URL).toBe('from_dotenv')
      expect(process.env.PASSWORD).toBe('from_dotenv')
      expect(parsed).toEqual({
        DATABASE_URL: 'from_dotenv',
        PASSWORD: 'from_dotenv'
      })
    })

    it('environment variables takes precedence over others', async () => {
      process.env.DATABASE_URL = 'from_environment'
      process.env.PASSWORD = 'from_environment'

      mockReadFileSync.mockReturnValue(`
        DATABASE_URL=from_dotenv
        PASSWORD=from_dotenv
      `)

      appConfigListMock.mockReturnValueOnce(
        mockAppConfigListResponse([
          {
            key: 'DATABASE_URL',
            value: 'from_appconfig'
          },
          {
            key: 'PASSWORD',
            value: 'from_appconfig'
          }
        ])
      )

      const { parsed } = await dotenvAzure.config()

      expect(process.env.DATABASE_URL).toBe('from_environment')
      expect(process.env.PASSWORD).toBe('from_environment')
      expect(parsed).toEqual({
        DATABASE_URL: 'from_dotenv',
        PASSWORD: 'from_dotenv'
      })
    })

    it('validates against a .env.example file', async () => {
      const { parsed, dotenv, azure } = await dotenvAzure.config({
        safe: true,
        example: 'myvars/.env.example'
      })

      expect(mockReadFileSync).toBeCalledWith('myvars/.env.example')
      expect(dotenv.parsed).toEqual(dotenvVars)
      expect(azure).toEqual(azureVars)
      expect(parsed).toEqual({ ...azureVars, ...dotenvVars })
    })

    it('validates against a .env.example file when example option is not given', async () => {
      const { parsed, dotenv, azure } = await dotenvAzure.config({ safe: true })
      expect(mockReadFileSync).toBeCalledWith('.env.example')
      expect(dotenv.parsed).toEqual(dotenvVars)
      expect(azure).toEqual(azureVars)
      expect(parsed).toEqual({ ...azureVars, ...dotenvVars })
    })

    it('throws when a variable from .env.example is missing', () => {
      mockReadFileSync.mockImplementation(file => {
        if (file === '.env.example') return 'MISSING=""'
        return dotEnvVarsFileContent
      })

      expect(
        dotenvAzure.config({
          safe: true,
          example: '.env.example'
        })
      ).rejects.toThrowError(MissingEnvVarsError)
    })

    it('does not throw error when variable exists but is empty and allowEmptyValues option is true', async () => {
      mockReadFileSync.mockReturnValue('MISSING=""')

      const result = await dotenvAzure.config({
        safe: true,
        example: '.env.example',
        allowEmptyValues: true
      })

      expect(result).toBeDefined()
    })
  })

  describe('parse()', () => {
    test('parses a string in the .env file format and merges with AppConfig and KeyVault variables', async () => {
      const parsed = await dotenvAzure.parse(dotEnvVarsFileContent)
      expect(parsed).toEqual({ ...azureVars, ...dotenvVars })
    })
  })

  describe('loadFromAzure()', () => {
    it('returns parsed object with AppConfig and KeyVault variables', async () => {
      const result = await dotenvAzure.loadFromAzure()
      expect(result).toEqual(azureVars)
    })

    it('throws when AZURE_APP_CONFIG_URL and AZURE_APP_CONFIG_CONNECTION_STRING are not defined', () => {
      const dotenvAzure = new DotenvAzure()
      expect(dotenvAzure.loadFromAzure()).rejects.toThrowError(MissingAppConfigCredentialsError)
    })
  })
})
