import { readFileSync } from "node:fs";

export function parseLocalEnvironment(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

export function loadLocalEnvironment(path: string): void {
  const values = parseLocalEnvironment(readFileSync(path, "utf8"));
  for (const [key, value] of Object.entries(values)) {
    // Local development must use the checked .env file even when the shell
    // still contains credentials from an older BotFather token or secret.
    process.env[key] = value;
  }
}
