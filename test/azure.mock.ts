import { ConfigurationSetting } from '@azure/app-configuration'
import { KeyVaultSecret } from '@azure/keyvault-secrets'

export interface AppConfigListItemMock {
  key: string
  value: string
}

export async function* mockAppConfigListResponse(items: ConfigurationSetting[]) {
  for (const item of items) {
    yield item
  }
}

export const appConfigListMock = jest.fn(() =>
  mockAppConfigListResponse([
    {
      isReadOnly: false,
      key: 'APP_CONFIG_VAR',
      value: 'ok',
      label: 'the-label',
    },
    {
      isReadOnly: true,
      key: 'KEY_VAULT_VAR',
      value:
        '{"uri": "https://key.vault.azure.net/secrets/DatabaseUrl/7091540ce97143deb08790a53fc2a75d"}',
      contentType: 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8',
    },
  ])
)

export const AppConfigurationClientMock = jest.mock('@azure/app-configuration', () => ({
  AppConfigurationClient: class AppConfigurationClient {
    listConfigurationSettings: any
    constructor() {
      this.listConfigurationSettings = appConfigListMock
    }
  },
}))

export const secretsClientMock = jest.mock('@azure/keyvault-secrets', () => ({
  SecretClient: class SecretClient {
    getSecret: any
    constructor() {
      this.getSecret = async (secretName: string): Promise<KeyVaultSecret> => {
        return {
          name: secretName,
          value: 'ok',
          properties: {
            vaultUrl: 'https://key.vault.azure.net',
            name: 'DatabaseUrl',
          },
        }
      }
    }
  },
}))
