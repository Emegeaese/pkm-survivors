export type DeepPartial<T> = T extends (...args: never[]) => unknown ? T : T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** `over` laid over `base`: objects merge key by key, anything else (strings, functions, lists) is taken from `over`. */
export const deepMerge = <T>(base: unknown, over: unknown): T => {
  if (!isPlain(base) || !isPlain(over)) return (over === undefined ? base : over) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(over)) out[key] = key in base ? deepMerge(base[key], value) : value
  return out as T
}
