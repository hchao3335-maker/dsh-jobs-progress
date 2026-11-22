/**
 * dsh-jobs-progress — Host half.
 *
 * The monitor needs no Host routes or services: the browser half reads the
 * built-in `ctx.jobs` client service directly. This entry exists so the bundle
 * patch has a row to activate; activation is also what loads `dsh.client`.
 */
export function apply() {}
