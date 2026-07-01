import { afterEach, describe, expect, it } from 'vitest';
import { ensurePdfJsRuntimeCompat } from './attachmentPdfRuntimeCompat';

type PromiseConstructorWithResolvers = PromiseConstructor & {
  withResolvers?: <T>() => {
    promise: Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: unknown) => void;
  };
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

type GlobalWithStructuredClone = typeof globalThis & {
  structuredClone?: <T>(value: T, options?: { transfer?: unknown[] }) => T;
};

const promiseConstructor = Promise as PromiseConstructorWithResolvers;
const urlConstructor = URL as UrlConstructorWithParse;
const arrayPrototype = Array.prototype as ArrayPrototypeWithFindLast;
const stringPrototype = String.prototype as StringPrototypeWithReplaceAll;
const uint8ArrayPrototype = Uint8Array.prototype as TypedArrayPrototypeWithAt;
const uint8ArrayConstructor = Uint8Array as Uint8ArrayConstructorWithBase64;
const uint8ArrayBase64Prototype = Uint8Array.prototype as Uint8ArrayPrototypeWithBase64;
const runtime = globalThis as GlobalWithStructuredClone;

const originalPromiseWithResolvers = promiseConstructor.withResolvers;
const originalPromiseTry = promiseConstructor.try;
const originalUrlParse = urlConstructor.parse;
const originalFindLast = arrayPrototype.findLast;
const originalArrayAt = arrayPrototype.at;
const originalReplaceAll = stringPrototype.replaceAll;
const originalStringAt = stringPrototype.at;
const originalUint8ArrayAt = uint8ArrayPrototype.at;
const originalUint8ArrayFromBase64 = uint8ArrayConstructor.fromBase64;
const originalUint8ArraySetFromBase64 = uint8ArrayBase64Prototype.setFromBase64;
const originalUint8ArrayToBase64 = uint8ArrayBase64Prototype.toBase64;
const originalStructuredClone = runtime.structuredClone;

function restoreProperty<T extends object>(target: T, key: PropertyKey, value: unknown) {
  if (value === undefined) {
    Reflect.deleteProperty(target, key);
    return;
  }

  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value
  });
}

afterEach(() => {
  restoreProperty(promiseConstructor, 'withResolvers', originalPromiseWithResolvers);
  restoreProperty(promiseConstructor, 'try', originalPromiseTry);
  restoreProperty(urlConstructor, 'parse', originalUrlParse);
  restoreProperty(arrayPrototype, 'findLast', originalFindLast);
  restoreProperty(arrayPrototype, 'at', originalArrayAt);
  restoreProperty(stringPrototype, 'replaceAll', originalReplaceAll);
  restoreProperty(stringPrototype, 'at', originalStringAt);
  restoreProperty(uint8ArrayPrototype, 'at', originalUint8ArrayAt);
  restoreProperty(uint8ArrayConstructor, 'fromBase64', originalUint8ArrayFromBase64);
  restoreProperty(uint8ArrayBase64Prototype, 'setFromBase64', originalUint8ArraySetFromBase64);
  restoreProperty(uint8ArrayBase64Prototype, 'toBase64', originalUint8ArrayToBase64);
  restoreProperty(runtime, 'structuredClone', originalStructuredClone);
});

describe('ensurePdfJsRuntimeCompat', () => {
  it('fills missing Promise helpers and URL.parse', async () => {
    Reflect.deleteProperty(promiseConstructor, 'withResolvers');
    Reflect.deleteProperty(promiseConstructor, 'try');
    Reflect.deleteProperty(urlConstructor, 'parse');

    ensurePdfJsRuntimeCompat();

    expect(typeof promiseConstructor.withResolvers).toBe('function');
    expect(typeof promiseConstructor.try).toBe('function');
    expect(typeof urlConstructor.parse).toBe('function');

    const { promise, resolve } = promiseConstructor.withResolvers!<number>();
    resolve(7);
    await expect(promise).resolves.toBe(7);
    await expect(promiseConstructor.try!(() => 9)).resolves.toBe(9);
    await expect(promiseConstructor.try!((left: number, right: number) => left + right, 4, 5)).resolves.toBe(9);
    await expect(promiseConstructor.try!(() => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    expect(urlConstructor.parse?.('https://example.com/test')?.href).toBe('https://example.com/test');
    expect(urlConstructor.parse?.('not a url')).toBeNull();
  });

  it('fills missing Array.findLast and String.replaceAll', () => {
    Reflect.deleteProperty(arrayPrototype, 'findLast');
    Reflect.deleteProperty(stringPrototype, 'replaceAll');

    ensurePdfJsRuntimeCompat();

    const findLast = arrayPrototype.findLast as (
      this: ArrayLike<number>,
      predicate: (value: number, index: number, array: ArrayLike<number>) => unknown
    ) => number | undefined;

    expect(findLast.call([1, 2, 3, 4], (value) => value < 4)).toBe(3);
    expect(stringPrototype.replaceAll!.call('pharos-pdf-pharos', 'pharos', 'polaris')).toBe('polaris-pdf-polaris');
  });

  it('fills missing at helpers and structuredClone', () => {
    Reflect.deleteProperty(arrayPrototype, 'at');
    Reflect.deleteProperty(stringPrototype, 'at');
    Reflect.deleteProperty(uint8ArrayPrototype, 'at');
    Reflect.deleteProperty(runtime, 'structuredClone');

    ensurePdfJsRuntimeCompat();

    expect(arrayPrototype.at!.call(['a', 'b', 'c'], -1)).toBe('c');
    expect(stringPrototype.at!.call('pharos', -2)).toBe('o');
    expect(uint8ArrayPrototype.at!.call(new Uint8Array([4, 7, 9]), -1)).toBe(9);

    const sourceBuffer = new Uint8Array([1, 2, 3]).buffer;
    const cloned = runtime.structuredClone!({
      payload: new Uint8Array(sourceBuffer),
      nested: ['ok']
    }, { transfer: [sourceBuffer] });

    expect(cloned.payload).toBeInstanceOf(Uint8Array);
    expect([...cloned.payload]).toEqual([1, 2, 3]);
    expect(cloned.payload.buffer).not.toBe(sourceBuffer);
    expect(sourceBuffer.byteLength).toBe(3);
    expect(cloned.nested).toEqual(['ok']);
  });

  it('fills missing Uint8Array base64 helpers used by pdfjs', () => {
    Reflect.deleteProperty(uint8ArrayConstructor, 'fromBase64');
    Reflect.deleteProperty(uint8ArrayBase64Prototype, 'setFromBase64');
    Reflect.deleteProperty(uint8ArrayBase64Prototype, 'toBase64');

    ensurePdfJsRuntimeCompat();

    expect([...uint8ArrayConstructor.fromBase64!('UG9sYXJpcw==')]).toEqual([80, 111, 108, 97, 114, 105, 115]);

    const target = new Uint8Array(4) as Uint8ArrayPrototypeWithBase64;
    expect(target.setFromBase64!('QUJDREU=')).toEqual({
      read: 'QUJDREU='.length,
      written: 4
    });
    expect([...target]).toEqual([65, 66, 67, 68]);
    expect((new Uint8Array([65, 65]) as Uint8ArrayPrototypeWithBase64).toBase64!()).toBe('QUE=');
  });
});
