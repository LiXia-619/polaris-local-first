import { Capacitor } from '@capacitor/core';

export function resolveDocumentFilePickerAccept(accept: string): string | undefined {
  return Capacitor.isNativePlatform() ? undefined : accept;
}
