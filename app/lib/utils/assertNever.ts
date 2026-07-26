export function assertNever(val: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(val)}`);
}
