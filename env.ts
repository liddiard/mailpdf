/**
 * Typed, validated access to server environment variables.
 *
 * Importing this module fails fast when a required variable is missing so that
 * misconfiguration surfaces at startup instead of on the first request.
 */

/**
 * Read a required environment variable.
 * @param name environment variable name
 * @returns the variable's value
 * @throws if the variable is unset or empty
 */
const required = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

/**
 * Parse an integer environment variable, falling back to a default.
 * @param name environment variable name
 * @param fallback value to use when the variable is unset
 * @returns the parsed integer
 * @throws if the variable is set but not a valid integer
 */
const int = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (!raw) {
    return fallback
  }
  const parsed = parseInt(raw, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}"`)
  }
  return parsed
}

/**
 * Server configuration derived from `process.env`. API keys required to
 * construct the Lob and Stripe clients are validated eagerly; Amazon SES
 * credentials remain optional so the server can start without email.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: int('PORT', 3000),
  lobApiKeyTest: required('LOB_API_KEY_TEST'),
  lobApiKey: required('LOB_API_KEY'),
  stripeApiKeyTest: required('STRIPE_API_KEY_TEST'),
  stripeApiKey: required('STRIPE_API_KEY'),
  awsRegion: process.env.AWS_REGION,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  adminEmail: process.env.ADMIN_EMAIL
} as const
