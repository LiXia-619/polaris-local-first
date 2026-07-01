# Attachments And Assets Intent

Attachments and assets bring user material into the AI workspace. They cover
picked files, pasted media, generated images, imported assets, parsed document
content, blob references, previews, tags, and tool-readable attachment data.

The product goal is to let the model and user work with real materials. A file
or image should have a visible card, a durable asset identity when saved, and a
clear path into request context or tool execution.

## Product Principles

### Attachments enter through typed processing

Document, spreadsheet, PDF, archive, image, and general file inputs pass through
processors that classify content and create tool-readable entries.

Implementation evidence:

- `src/engines/attachmentProcessor.ts`
- `src/engines/attachmentDocumentReaders.ts`
- `src/engines/attachmentSpreadsheetReaders.ts`
- `src/engines/attachmentArchiveTools.ts`
- `src/engines/attachmentToolEntries.ts`
- `src/engines/attachmentToolData.ts`

### Assets preserve durable media identity

Assets store metadata, references, previews, tags, blob availability, and
governance state so saved media can survive beyond one message.

Implementation evidence:

- `src/stores/asset/index.ts`
- `src/stores/assetLocalDataPersistence.ts`
- `src/infrastructure/assetStore.ts`
- `src/engines/assetReferences.ts`
- `src/engines/assetGovernance.ts`

### Media has collection and chat surfaces

Images and file materials appear in composer attachments, message attachments,
collection image shelves, previews, and share/import flows.

Implementation evidence:

- `src/ui/worlds/chat/ChatAttachmentStrip.tsx`
- `src/ui/worlds/chat/composer/ComposerAttachments.tsx`
- `src/ui/collection/images/ImageCollectionShelf.tsx`
- `src/ui/collection/images/ImageAssetPreview.tsx`
- `src/app/collection/imageAssetImport.ts`
- `src/app/collection/imageAssetShare.ts`

## Adjacent Responsibilities

- Context governance decides how processed attachment content enters a request.
- Tool contracts own tool execution that reads or writes attachment-derived
  data.
- Collection world owns saved asset browsing.
- LocalData owns durable asset rows and blob references.
