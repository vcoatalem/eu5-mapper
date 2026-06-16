export function getOrCreate<K, V>(map: Map<K, V>, key: K, mk: () => V): V {
  let v = map.get(key);
  if (v === undefined) { v = mk(); map.set(key, v); }
  return v;
}
