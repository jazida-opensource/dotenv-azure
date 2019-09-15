module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'standard',
    'prettier',
    'prettier/@typescript-eslint'
  ],
  parserOptions: {
    ecmaVersion: 2019,
    sourceType: 'module'
  },
  env: {
    node: true,
    jest: true
  },
  rules: {
    '@typescript-eslint/member-delimiter-style': 0,
    'no-multi-str': 0,
    'no-useless-constructor': 0,
    '@typescript-eslint/no-useless-constructor': 1,
    'no-dupe-class-members': 0
  }
}
