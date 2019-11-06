import { VariablesObject } from './types'

export function difference(arrA: string[], arrB: string[]): string[] {
  return arrA.filter(a => !arrB.includes(a))
}

export function compact(obj: VariablesObject): VariablesObject {
  const result: VariablesObject = {}
  Object.entries(obj).forEach(([key, val]) => {
    if (val) {
      result[key] = val
    }
  })
  return result
}

export function testIfValueIsVaultSecret(value: string): URL | undefined {
  const result = /^kv:(.+)/.exec(value)
  let keyVaultUrl
  try {
    keyVaultUrl = result ? new URL(result[1]) : undefined
  } catch {
    // noop
  }
  return keyVaultUrl
}

/**
 * Add variable if does not exist in process.env
 * @param variables - an object with keys and values
 */
export function populateProcessEnv(variables: VariablesObject): void {
  Object.entries(variables).forEach(([key, val]) => key in process.env || (process.env[key] = val))
}
