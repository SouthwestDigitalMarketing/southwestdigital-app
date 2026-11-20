/** "A" … "Z", then "AA", "AB" … */
function letters(index: number): string {
  let out = "";
  let n = index;
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** "Client A" … "Client Z", then "Client AA", "Client AB" … */
export function clientAlias(index: number): string {
  return `Client ${letters(index)}`;
}

export type Aliaser = (name: string, kind?: "Client" | "Lead") => string;

/**
 * Stand-in names for one page render while privacy is on. The same name gets the
 * same letter everywhere on the page; clients and leads are lettered separately
 * ("Client A", "Lead A"). Letters follow the order names are first asked for, so
 * they can change between renders.
 */
export function createAliaser(): Aliaser {
  const seen = new Map<string, string>();
  const counts = { Client: 0, Lead: 0 };
  return (name, kind = "Client") => {
    const key = `${kind}|${name.trim().toLowerCase()}`;
    let found = seen.get(key);
    if (!found) {
      found = `${kind} ${letters(counts[kind]++)}`;
      seen.set(key, found);
    }
    return found;
  };
}
