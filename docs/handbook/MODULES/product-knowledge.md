# Product Knowledge

The in-app product documentation — the user guide, the "let the AI help you" guide, the
backup/migration guide, and the privacy statement. It is rendered in the app's docs menu and is
also readable by the assistant as a tool, so a user can ask the AI "how do I export my data?"
and get an answer grounded in the same source text the menu shows.

## Where it lives

```
src/app/shell/
  productDocs.ts                       — registry & API (≈160 lines): localize, format, query
  productKnowledge/
    types.ts                           — ProductDoc / ProductDocSection / ProductDocId / ProductDocTranslation
    contentZh.ts                       — PRODUCT_DOCS: the zh-CN catalog (source of truth)
    contentEn.ts                       — EN_PRODUCT_DOC_TRANSLATIONS: English overlay
    themeBeautificationSelectorGuide.ts — one shared section reused inside the catalog
```

Content and code are deliberately separated: `productKnowledge/content*.ts` is prose data,
`productDocs.ts` is logic. Editing a doc never touches the logic, and reviewing the logic never
means scrolling past a thousand lines of copy.

## The data model

A `ProductDoc` is one document (`id`, `title`, `kicker`, `summary`, `detail`, `updatedAt`, and a
list of `ProductDocSection`s). A `ProductDocSection` is a `heading` plus optional `body`
paragraphs and `bullets`. There are four documents, keyed by `ProductDocId`:
`'user-guide' | 'ai-guide' | 'backup-migration' | 'privacy'`.

`contentZh.ts` is the **source of truth**: every document and every section exists there in full.
`contentEn.ts` is an **overlay**, not a parallel catalog — each entry is a `ProductDocTranslation`
that supplies only the fields that differ in English (title/summary/detail and either a full
`sections` array or a `sectionTranslations` map keyed by the zh heading). A document with no
English entry simply renders its zh text.

## Public API (`productDocs.ts`)

| Function | Purpose |
|---|---|
| `getProductDocs(language?)` | All four docs, localized to the language (defaults `zh-CN`). |
| `getProductDoc(id, language?)` | One doc by id, localized. |
| `formatProductDocAsMarkdown(doc, language?)` | Render a full doc to Markdown (used for copy-to-clipboard and AI reads). |
| `formatProductDocIndexAsMarkdown(doc, language?)` | Render just the heading index of a doc. |
| `readProductDocByTopic(doc, topic?, language?)` | Return the whole doc, or only the sections matching a topic, as Markdown — the assistant's entry point. |
| `PRODUCT_DOCS` | The raw zh catalog (re-exported for callers that localize themselves). |

Localization is internal: `localizeProductDoc` merges the zh document with its English overlay
when `language` is `'en-US'`. Callers never touch the overlay directly.

## Consumers

- **`src/ui/shell/menu/MenuDocsPage.tsx`** — the docs menu page. Lists docs, renders one, and
  copies it as Markdown.
- **`src/app/chat/chatToolExecutionContext.ts`** — the assistant tool path. Calls
  `getProductDoc` + `readProductDocByTopic` so the AI can quote the docs by topic.

## How to edit

- **Change wording / add a section:** edit `contentZh.ts` (and, if the doc is translated, mirror
  the change in `contentEn.ts`). Bump the document's `updatedAt`.
- **Add a new document:** add a `ProductDocId`, append a `ProductDoc` to `contentZh.ts`, and
  optionally add an `EN_PRODUCT_DOC_TRANSLATIONS` entry. No API change is needed — the new doc
  flows through `getProductDocs` and the menu automatically.
- **Reuse a section across docs:** export it from its own module (see
  `themeBeautificationSelectorGuide.ts`) and reference it in the catalog.

Keep `contentZh.ts` authoritative: if zh and en disagree about which sections exist, zh wins and
the missing English sections fall back to their zh text.
