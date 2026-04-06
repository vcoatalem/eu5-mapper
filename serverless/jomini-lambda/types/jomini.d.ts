export function parse_text(
  d: Uint8Array,
  encoding: any,
  type_narrowing: any,
): Query;
/**
 * Holds the parsed data for a short period of time, allowing a user to extract all or a subset of the
 * parsed document
 */
export class Query {
  private constructor();
  free(): void;
  /**
   * Return the object, array, or value pointed at by the query. Uses a format similar to JSON pointer:
   *
   * ```ignore
   * /player
   * /countries/ENG/prestige
   * ```
   */
  at(query: string): any;
  /**
   * Convert the entire document into a JSON string
   */
  json(pretty: boolean, key_mode: string): any;
  /**
   * Convert the entire document into an object
   */
  root(): any;
}

/**
 * Supported encodings: UTF8 and Windows1252
 */
export type Encoding = "utf8" | "windows1252";
/**
 * When to narrow string types to a more specific type
 *
 * - all: For both quoted and unquoted values
 * - unquoted: For only unquoted values
 * - none: Never narrow
 */
export type TypeNarrowing = "all" | "unquoted" | "none";
/**
 * Tweaks the knobs used in parsing
 */
export type ParseOptions = {
  /**
   * The encoding used to transform bytes to strings
   */
  encoding: Encoding;
  /**
   * The type desired narrowing scheme
   */
  typeNarrowing: TypeNarrowing;
};

export declare class Jomini {
  private constructor();
  /**
   * Parses plain text data into javascript values
   *
   * @param data The data to parse, can either be raw bytes or a string. If given a string, the
   * string will be encoded as utf-8. Else if given bytes, they are assumed to be utf-8 unless the
   * windows1252 is passed as the encoding.
   * @param options Controls the encoding of the data. If not configured, assumes utf-8
   */
  parseText(
    data: Uint8Array | string,
    options?: Partial<ParseOptions>,
  ): ReturnType<Query["root"]>;
  /**
   * Parses plain text data into javascript values
   *
   * @param data The data to parse, can either be raw bytes or a string. If given a string, the
   * string will be encoded as utf-8. Else if given bytes, they are assumed to be utf-8 unless the
   * windows1252 is passed as the encoding.
   * @param options Controls the encoding of the data. If not configured, assumes utf-8
   * @param cb The callback to extract a subset of the parsed document. Since creating JS objects
   * is where 95-99% of the performance is lost, one can achieve a great speedup by requesting only
   * the bits needed. If a callback is not provided, then the entire parsed document is returned.
   */
  parseText<T>(
    data: Uint8Array | string,
    options: Partial<ParseOptions>,
    cb: (arg0: Query) => T,
  ): T;
  /**
   * Initializes a jomini parser. There is a one time global setup fee (sub 30ms), but subsequent
   * requests to initialize will be instantaneous, so it's not imperative to reuse the same parser.
   */
  static initialize: () => Promise<Jomini>;
  /**
   * Resets initialization so that one can initialize the module again. Only
   * intended for tests.
   */
  static resetModule: () => void;
}
/**
 * Tweaks the knobs used in JSON generation
 */
export type JsonOptions = Partial<{
  /**
   * If the JSON should be pretty-printed. Defaults to false
   */
  pretty: boolean;
  /**
   * Determines how duplicate keys are serialized
   *
   * @see {@link https://docs.rs/jomini/0.19.0/jomini/json/enum.DuplicateKeyMode.html}
   */
  duplicateKeyMode: "group" | "preserve" | "key-value-pairs";
}>;
