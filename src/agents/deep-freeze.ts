/**
 * Freeze a value through and through.
 *
 * `readonly` is a compile-time promise and disappears at runtime; this is the
 * runtime half. Scoped Tools are read-only functions (ADR 0004) and this is
 * what makes "no Question can mutate a Dataset" true of the running program
 * rather than only of the types.
 *
 * Shared by both Datasets, which is not the shared data layer ADR 0004 rules
 * out: this is a utility that freezes whatever it is handed and reads nothing.
 * The Datasets remain two objects, parsed from two files, with no reference in
 * common — `agents/isolation.test.ts` holds them to it.
 */
export const deepFreeze = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};
