export interface S2SConfig extends Record<string, any> {
  'services-token-url': [null, StringConstructor]
  // This is used by the auth service to make sure tokens are valid
  'token-api-key': [null, StringConstructor]
}

export const types: S2SConfig = {
  'services-token-url': [null, String],
  'token-api-key': [null, String],
}

export const defaults = {
  'services-token-url': 'http://localhost:15678',
}
