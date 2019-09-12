import DotenvAzure from '../src/dotenv-azure'

test('DotenvAzure is instantiable', () => {
  expect(new DotenvAzure()).toBeInstanceOf(DotenvAzure)
})
