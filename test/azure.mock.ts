export interface AppConfigListItemMock {
  key: string
  value: string
}

export function mockAppConfigListResponse(items: AppConfigListItemMock[]) {
  return {
    _response: {
      parsedBody: { items }
    }
  }
}

export const appConfigListMock = jest.fn(() =>
  mockAppConfigListResponse([
    {
      key: 'APP_CONFIG_VAR',
      value: 'ok'
    },
    {
      key: 'KEY_VAULT_VAR',
      value: 'kv:https://key.vault.azure.net/secrets/DatabaseUrl/7091540ce97143deb08790a53fc2a75d'
    }
  ])
)

export const AppConfigurationClientMock = jest.mock('../src/app-config', () => ({
  AppConfigurationClient: class AppConfigurationClient {
    listConfigurationSettings: any
    constructor() {
      this.listConfigurationSettings = appConfigListMock
    }
  }
}))

export const secretsClientMock = jest.mock('@azure/keyvault-secrets', () => ({
  SecretsClient: class SecretsClient {
    getSecret: any
    constructor() {
      this.getSecret = () => {
        return {
          key: 'DatabaseUrl',
          value: 'ok'
        }
      }
    }
  }
}))
