const GENERIC_IMAGE_TITLE_PATTERN =
  /^(img[_-]?\d+|image[_-]?\d+|photo[_-]?\d+|screenshot(?:[-_\s]?\d+)?|mmexport\d+|wechatimg\d+|图片|图片收藏|参考图|生成图|截图|正片)$/i;

export function isGenericImageTitle(value: string) {
  return GENERIC_IMAGE_TITLE_PATTERN.test(value.trim());
}
