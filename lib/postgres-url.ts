const LEGACY_SSL_MODE = /([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/i;

export function securePostgresConnectionString(value: string) {
  return value.replace(LEGACY_SSL_MODE, "$1verify-full");
}
