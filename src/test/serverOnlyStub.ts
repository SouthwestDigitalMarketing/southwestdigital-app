// Vitest alias target for the `server-only` package so unit tests can import
// modules that mark themselves server-only. In the real build `server-only`
// throws when included in a client bundle; in tests we run in Node and just
// want a no-op.
export {};
