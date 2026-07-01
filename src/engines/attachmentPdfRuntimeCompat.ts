type PromiseResolvers<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type PromiseWithResolversConstructor = PromiseConstructor & {
  withResolvers?: <T>() => PromiseResolvers<T>;
  try?: <T, TArgs extends unknown[]>(
    callback: (...args: TArgs) => T | PromiseLike<T>,
    ...args: TArgs
  ) => Promise<T>;
};

type UrlConstructorWithParse = typeof URL & {
  parse?: (url: string | URL, base?: string | URL) => URL | null;
};

type ArrayPrototypeWithFindLast = Array<unknown> & {
  findLast?: <T>(
    this: ArrayLike<T>,
    predicate: (value: T, index: number, array: ArrayLike<T>) => unknown,
    thisArg?: unknown
  ) => T | undefined;
  at?: <T>(this: ArrayLike<T>, index: number) => T | undefined;
};

type StringPrototypeWithReplaceAll = String & {
  replaceAll?: (
    searchValue: string | RegExp,
    replaceValue: string | ((substring: string, ...args: unknown[]) => string)
  ) => string;
  at?: (index: number) => string | undefined;
};

type TypedArrayPrototypeWithAt = {
  at?: (index: number) => number | undefined;
};

type Uint8ArrayConstructorWithBase64 = Uint8ArrayConstructor & {
  fromBase64?: (value: string) => Uint8Array;
};

type Uint8ArrayPrototypeWithBase64 = Uint8Array & {
  setFromBase64?: (value: string) => { read: number; written: number };
  toBase64?: () => string;
};

type StructuredCloneOptions = {
  transfer?: unknown[];
};

type GlobalWithStructuredClone = typeof globalThis & {
  structuredClone?: <T>(value: T, options?: StructuredCloneOptions) => T;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensurePromiseWithResolvers() {
  const promiseConstructor = Promise as PromiseWithResolversConstructor;
  if (typeof promiseConstructor.withResolvers === 'function') {
    return;
  }

  Object.defineProperty(promiseConstructor, 'withResolvers', {
    configurable: true,
    writable: true,
    value: function withResolvers<T>(): PromiseResolvers<T> {
      let resolve!: (value: T | PromiseLike<T>) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
      });
      return { promise, resolve, reject };
    }
  });
}

function ensurePromiseTry() {
  const promiseConstructor = Promise as PromiseWithResolversConstructor;
  if (typeof promiseConstructor.try === 'function') {
    return;
  }

  Object.defineProperty(promiseConstructor, 'try', {
    configurable: true,
    writable: true,
    value: function promiseTry<T, TArgs extends unknown[]>(
      callback: (...args: TArgs) => T | PromiseLike<T>,
      ...args: TArgs
    ): Promise<T> {
      return new Promise<T>((resolve) => {
        resolve(callback(...args));
      });
    }
  });
}

function ensureUrlParse() {
  const urlConstructor = URL as UrlConstructorWithParse;
  if (typeof urlConstructor.parse === 'function') {
    return;
  }

  Object.defineProperty(urlConstructor, 'parse', {
    configurable: true,
    writable: true,
    value: (url: string | URL, base?: string | URL) => {
      try {
        return base === undefined ? new URL(String(url)) : new URL(String(url), base);
      } catch {
        return null;
      }
    }
  });
}

function ensureArrayFindLast() {
  const arrayPrototype = Array.prototype as ArrayPrototypeWithFindLast;
  if (typeof arrayPrototype.findLast === 'function') {
    return;
  }

  Object.defineProperty(arrayPrototype, 'findLast', {
    configurable: true,
    writable: true,
    value: function findLast<T>(
      this: ArrayLike<T>,
      predicate: (value: T, index: number, array: ArrayLike<T>) => unknown,
      thisArg?: unknown
    ) {
      if (typeof predicate !== 'function') {
        throw new TypeError('predicate must be a function');
      }

      const array = Object(this) as ArrayLike<T>;
      const length = Number(array.length) >>> 0;
      for (let index = length - 1; index >= 0; index -= 1) {
        const value = array[index];
        if (predicate.call(thisArg, value, index, array)) {
          return value;
        }
      }
      return undefined;
    }
  });
}

function normalizeAtIndex(length: number, index: number) {
  const normalizedIndex = Math.trunc(index) || 0;
  return normalizedIndex >= 0 ? normalizedIndex : length + normalizedIndex;
}

function ensureArrayAt() {
  const arrayPrototype = Array.prototype as ArrayPrototypeWithFindLast;
  if (typeof arrayPrototype.at === 'function') {
    return;
  }

  Object.defineProperty(arrayPrototype, 'at', {
    configurable: true,
    writable: true,
    value: function at<T>(this: ArrayLike<T>, index: number) {
      const array = Object(this) as ArrayLike<T>;
      const length = Number(array.length) >>> 0;
      const resolvedIndex = normalizeAtIndex(length, index);
      if (resolvedIndex < 0 || resolvedIndex >= length) {
        return undefined;
      }
      return array[resolvedIndex];
    }
  });
}

function ensureStringReplaceAll() {
  const stringPrototype = String.prototype as StringPrototypeWithReplaceAll;
  if (typeof stringPrototype.replaceAll === 'function') {
    return;
  }

  Object.defineProperty(stringPrototype, 'replaceAll', {
    configurable: true,
    writable: true,
    value: function replaceAll(
      this: string,
      searchValue: string | RegExp,
      replaceValue: string | ((substring: string, ...args: unknown[]) => string)
    ) {
      const source = String(this);

      if (searchValue instanceof RegExp) {
        if (!searchValue.global) {
          throw new TypeError('searchValue must be a global RegExp');
        }
        return source.replace(searchValue, replaceValue as never);
      }

      const matcher = new RegExp(searchValue === '' ? '(?:)' : escapeRegExp(String(searchValue)), 'g');
      return source.replace(matcher, replaceValue as never);
    }
  });
}

function ensureStringAt() {
  const stringPrototype = String.prototype as StringPrototypeWithReplaceAll;
  if (typeof stringPrototype.at === 'function') {
    return;
  }

  Object.defineProperty(stringPrototype, 'at', {
    configurable: true,
    writable: true,
    value: function at(this: string, index: number) {
      const source = String(this);
      const resolvedIndex = normalizeAtIndex(source.length, index);
      if (resolvedIndex < 0 || resolvedIndex >= source.length) {
        return undefined;
      }
      return source.charAt(resolvedIndex);
    }
  });
}

function ensureTypedArrayAt() {
  const prototypes = [
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
    typeof BigInt64Array === 'function' ? BigInt64Array : null,
    typeof BigUint64Array === 'function' ? BigUint64Array : null
  ]
    .filter(Boolean)
    .map((ctor) => (ctor as typeof Uint8Array).prototype as TypedArrayPrototypeWithAt);

  for (const prototype of prototypes) {
    if (typeof prototype.at === 'function') {
      continue;
    }

    Object.defineProperty(prototype, 'at', {
      configurable: true,
      writable: true,
      value: function at(this: ArrayLike<number>, index: number) {
        const length = Number(this.length) >>> 0;
        const resolvedIndex = normalizeAtIndex(length, index);
        if (resolvedIndex < 0 || resolvedIndex >= length) {
          return undefined;
        }
        return this[resolvedIndex];
      }
    });
  }
}

function normalizeBase64(value: string) {
  const normalized = value.replace(/[\t\n\f\r ]+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return `${normalized}${'='.repeat(paddingLength)}`;
}

function decodeBase64(value: string) {
  const normalized = normalizeBase64(value);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)));
  }
  return btoa(chunks.join(''));
}

function ensureUint8ArrayBase64() {
  const uint8ArrayConstructor = Uint8Array as Uint8ArrayConstructorWithBase64;
  const uint8ArrayPrototype = Uint8Array.prototype as Uint8ArrayPrototypeWithBase64;

  if (typeof uint8ArrayConstructor.fromBase64 !== 'function') {
    Object.defineProperty(uint8ArrayConstructor, 'fromBase64', {
      configurable: true,
      writable: true,
      value: function fromBase64(value: string) {
        return decodeBase64(String(value));
      }
    });
  }

  if (typeof uint8ArrayPrototype.setFromBase64 !== 'function') {
    Object.defineProperty(uint8ArrayPrototype, 'setFromBase64', {
      configurable: true,
      writable: true,
      value: function setFromBase64(this: Uint8Array, value: string) {
        const bytes = decodeBase64(String(value));
        const writableBytes = bytes.subarray(0, this.length);
        this.set(writableBytes);
        return {
          read: String(value).length,
          written: writableBytes.length
        };
      }
    });
  }

  if (typeof uint8ArrayPrototype.toBase64 !== 'function') {
    Object.defineProperty(uint8ArrayPrototype, 'toBase64', {
      configurable: true,
      writable: true,
      value: function toBase64(this: Uint8Array) {
        return encodeBase64(this);
      }
    });
  }
}

function cloneArrayBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0);
}

function cloneArrayBufferView<T extends ArrayBufferView>(value: T) {
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const clonedBuffer = bytes.slice().buffer;

  if (value instanceof DataView) {
    return new DataView(clonedBuffer, 0, value.byteLength) as unknown as T;
  }

  return new (value.constructor as new (buffer: ArrayBuffer) => T)(clonedBuffer);
}

function cloneStructuredValue<T>(value: T, seen: WeakMap<object, unknown>): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return cloneArrayBuffer(value) as T;
  }

  if (ArrayBuffer.isView(value)) {
    return cloneArrayBufferView(value as ArrayBufferView) as T;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as T;
  }

  if (value instanceof Map) {
    const clone = new Map();
    seen.set(value, clone);
    for (const [entryKey, entryValue] of value.entries()) {
      clone.set(cloneStructuredValue(entryKey, seen), cloneStructuredValue(entryValue, seen));
    }
    return clone as T;
  }

  if (value instanceof Set) {
    const clone = new Set();
    seen.set(value, clone);
    for (const entry of value.values()) {
      clone.add(cloneStructuredValue(entry, seen));
    }
    return clone as T;
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const entry of value) {
      clone.push(cloneStructuredValue(entry, seen));
    }
    return clone as T;
  }

  const clone = Object.create(Object.getPrototypeOf(value));
  seen.set(value as object, clone);
  for (const key of Reflect.ownKeys(value as object)) {
    const descriptor = Object.getOwnPropertyDescriptor(value as object, key);
    if (!descriptor) continue;
    if ('value' in descriptor) {
      descriptor.value = cloneStructuredValue(descriptor.value, seen);
    }
    Object.defineProperty(clone, key, descriptor);
  }
  return clone;
}

function ensureStructuredClone() {
  const runtime = globalThis as GlobalWithStructuredClone;
  if (typeof runtime.structuredClone === 'function') {
    return;
  }

  Object.defineProperty(runtime, 'structuredClone', {
    configurable: true,
    writable: true,
    value: function structuredClone<T>(value: T, _options?: StructuredCloneOptions): T {
      return cloneStructuredValue(value, new WeakMap());
    }
  });
}

export function ensurePdfJsRuntimeCompat() {
  // Keep pdfjs-specific runtime shims at this boundary so the rest of Polaris
  // does not depend on older WebView compatibility behavior.
  ensurePromiseWithResolvers();
  ensurePromiseTry();
  ensureUrlParse();
  ensureArrayFindLast();
  ensureArrayAt();
  ensureTypedArrayAt();
  ensureUint8ArrayBase64();
  ensureStringReplaceAll();
  ensureStringAt();
  ensureStructuredClone();
}
