export class MissingEnvVarsError extends Error {
  private readonly missing: string[]
  private readonly example: string

  constructor(
    allowEmptyValues: boolean,
    dotenvFilename: string,
    exampleFilename: string,
    missingVars: string[],
    error?: Error
  ) {
    const errorMessage = `The following variables were defined in ${exampleFilename} but are not present in the environment: ${missingVars.join(
      ', '
    )}\n
Make sure to add them to ${dotenvFilename} or directly to the environment.`

    const allowEmptyValuesMessage = !allowEmptyValues
      ? 'If you expect any of these variables to be empty, you can use the `allowEmptyValues` option'
      : ''

    const envErrorMessage = error
      ? `Also, the following error was thrown when trying to read variables from  ${dotenvFilename}:\n${error.message}`
      : ''

    const message = [errorMessage, allowEmptyValuesMessage, envErrorMessage].filter(Boolean).join('\n\n')
    super(message)
    this.name = this.constructor.name
    this.missing = missingVars
    this.example = exampleFilename
    Error.captureStackTrace(this, this.constructor)
  }
}

export class InvalidKeyVaultUrlError extends Error {
  constructor(key: string) {
    const message = `Invalid Azure Key Vault URL: ${key}`
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}
