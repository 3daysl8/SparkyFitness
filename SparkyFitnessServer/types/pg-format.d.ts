/**
 * Minimal ambient types for 'pg-format' — ships no .d.ts of its own. Only
 * the default export this codebase uses (the format() tagged-template-style
 * SQL builder, called as format(sql, values)) is declared.
 */
declare module 'pg-format' {
  function format(sql: string, ...values: unknown[]): string;
  export default format;
}
