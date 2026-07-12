import assert from "node:assert/strict";
import test from "node:test";
import { securePostgresConnectionString } from "@/lib/postgres-url";

test("torna explicita a verificacao TLS nos modos legados", () => {
  assert.equal(
    securePostgresConnectionString("postgres://host/db?sslmode=require&channel_binding=require"),
    "postgres://host/db?sslmode=verify-full&channel_binding=require"
  );
  assert.equal(
    securePostgresConnectionString("postgres://host/db?pool=true&sslmode=verify-ca"),
    "postgres://host/db?pool=true&sslmode=verify-full"
  );
});

test("preserva URLs ja seguras ou sem sslmode", () => {
  assert.equal(
    securePostgresConnectionString("postgres://host/db?sslmode=verify-full"),
    "postgres://host/db?sslmode=verify-full"
  );
  assert.equal(securePostgresConnectionString("postgres://host/db"), "postgres://host/db");
});
