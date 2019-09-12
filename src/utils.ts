import { VariablesObject } from './dotenv-azure'

interface ProcessEnv {
  [key: string]: string | undefined
}

export function difference(arrA: string[], arrB: string[]) {
  return arrA.filter(a => arrB.indexOf(a) < 0)
}

export function compact(obj: ProcessEnv) {
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
