export type ReferenceDocBodyDirectory = {
  content: string;
  charCount?: number;
  contentLoaded?: boolean;
};

export function declaredReferenceDocBodyCharCount(doc: ReferenceDocBodyDirectory) {
  return typeof doc.charCount === 'number' ? doc.charCount : doc.content.length;
}

export function hasLoadedReferenceDocBody(doc: ReferenceDocBodyDirectory) {
  return doc.contentLoaded === true || doc.content.length > 0;
}

export function expectsUnloadedReferenceDocBody(doc: ReferenceDocBodyDirectory) {
  return doc.contentLoaded !== true
    && declaredReferenceDocBodyCharCount(doc) > doc.content.length;
}

export function wouldEraseUnloadedReferenceDocBody(doc: ReferenceDocBodyDirectory, content: string) {
  return content.length === 0 && expectsUnloadedReferenceDocBody(doc);
}

export function contentMatchesReferenceDocDirectory(
  doc: ReferenceDocBodyDirectory,
  content: string
) {
  return !expectsUnloadedReferenceDocBody(doc)
    || content.length >= declaredReferenceDocBodyCharCount(doc);
}

export function assertReferenceDocBodyMatchesDirectory(
  doc: ReferenceDocBodyDirectory,
  content: string,
  errorMessage: string
) {
  if (!contentMatchesReferenceDocDirectory(doc, content)) {
    throw new Error(errorMessage);
  }
}
