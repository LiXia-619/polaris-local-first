import { Capacitor, registerPlugin } from '@capacitor/core';
import { base64ToBytes } from './nativeBase64';

type NativePickedFile = {
  name?: string;
  mimeType?: string;
  fileUrl?: string;
  dataBase64?: string;
};

type NativePickedFilesResult = {
  canceled: boolean;
  files?: NativePickedFile[];
};

type SystemPickedFilePlugin = {
  importFiles: (options: {
    accept?: string;
    multiple?: boolean;
  }) => Promise<NativePickedFilesResult>;
};

const SystemFile = registerPlugin<SystemPickedFilePlugin>('SystemFile');

export function canUseNativeSystemFilePicker() {
  return Capacitor.isNativePlatform() && ['android', 'ios'].includes(Capacitor.getPlatform());
}

async function toFileFromNativeResult(result: NativePickedFile) {
  if (!result.name || (!result.fileUrl && !result.dataBase64)) {
    throw new Error('系统文件返回的内容不完整。');
  }

  if (result.fileUrl) {
    const response = await fetch(Capacitor.convertFileSrc(result.fileUrl));
    if (!response.ok) {
      throw new Error('读取导入文件失败。');
    }
    const blob = await response.blob();
    return new File([blob], result.name, {
      type: result.mimeType || blob.type || 'application/octet-stream'
    });
  }

  const bytes = base64ToBytes(result.dataBase64 ?? '');
  return new File([bytes], result.name, {
    type: result.mimeType || 'application/octet-stream'
  });
}

export async function pickNativeSystemFiles(options: {
  accept?: string;
  multiple?: boolean;
}) {
  const result = await SystemFile.importFiles({
    accept: options.accept,
    multiple: options.multiple ?? false
  });
  if (result.canceled) {
    return [];
  }
  return await Promise.all((result.files ?? []).map(toFileFromNativeResult));
}
