import type { AppLanguage } from '../../i18n';
import { PRODUCT_DOCS } from './productKnowledge/contentZh';
import { EN_PRODUCT_DOC_TRANSLATIONS } from './productKnowledge/contentEn';
import type { ProductDoc, ProductDocId, ProductDocSection } from './productKnowledge/types';

export type { ProductDoc, ProductDocId, ProductDocSection } from './productKnowledge/types';
export { PRODUCT_DOCS } from './productKnowledge/contentZh';

function localizeProductDoc(doc: ProductDoc, language: AppLanguage): ProductDoc {
  if (language === 'zh-CN') return doc;
  const translation = EN_PRODUCT_DOC_TRANSLATIONS[doc.id];
  if (!translation) return doc;
  const {
    sections: translatedSections,
    sectionTranslations,
    ...metadataTranslation
  } = translation;
  const sections = translatedSections
    ?? (sectionTranslations
      ? doc.sections.map((section) => sectionTranslations[section.heading] ?? section)
      : doc.sections);
  return {
    ...doc,
    ...metadataTranslation,
    sections
  };
}

export function getProductDocs(language: AppLanguage = 'zh-CN') {
  return PRODUCT_DOCS.map((doc) => localizeProductDoc(doc, language));
}

export function getProductDoc(id: ProductDocId, language: AppLanguage = 'zh-CN') {
  const docs = getProductDocs(language);
  return docs.find((doc) => doc.id === id) ?? docs[0];
}

export function formatProductDocAsMarkdown(doc: ProductDoc, language: AppLanguage = 'zh-CN') {
  const lines = [
    `# ${doc.title}`,
    '',
    `${doc.summary}`,
    '',
    language === 'zh-CN' ? `更新日期：${doc.updatedAt}` : `Updated ${doc.updatedAt}`,
    ''
  ];
  doc.sections.forEach((section) => {
    lines.push(`## ${section.heading}`, '');
    section.body?.forEach((paragraph) => {
      lines.push(paragraph, '');
    });
    section.bullets?.forEach((item) => {
      lines.push(`- ${item}`);
    });
    if (section.bullets?.length) lines.push('');
  });
  return lines.join('\n').trim();
}

export function formatProductDocIndexAsMarkdown(doc: ProductDoc, language: AppLanguage = 'zh-CN') {
  const indexTitle = language === 'zh-CN'
    ? `# ${doc.title}章节索引`
    : `# ${doc.title} chapter index`;
  const updatedLine = language === 'zh-CN'
    ? `更新日期：${doc.updatedAt}`
    : `Updated ${doc.updatedAt}`;
  const instruction = language === 'zh-CN'
    ? '先按用户问题选择一个章节，再用 readPolarisKnowledge 传入对应章节名或关键词读取正文；只有确实需要全局核对时才用 topic="全文"。'
    : 'Choose a chapter based on the user question, then call readPolarisKnowledge with that chapter name or keyword. Use topic="full" only when a full-document check is really needed.';
  const chapterHeading = language === 'zh-CN' ? '## 章节' : '## Chapters';
  const lines = [
    indexTitle,
    '',
    `${doc.summary}`,
    '',
    updatedLine,
    '',
    instruction,
    '',
    chapterHeading,
    ''
  ];

  doc.sections.forEach((section, index) => {
    const preview = [
      ...(section.body ?? []),
      ...(section.bullets ?? [])
    ].join(' ').replace(/\s+/g, ' ').slice(0, 96);
    lines.push(`${index + 1}. ${section.heading}${preview ? `：${preview}` : ''}`);
  });

  return lines.join('\n').trim();
}

function normalizeProductDocTopic(topic?: string) {
  return topic?.trim().toLowerCase() ?? '';
}

function shouldReadFullProductDoc(topic: string) {
  return ['全文', '完整', '完整文档', '全部', 'full', 'all'].includes(topic);
}

function filterProductDocSectionsByTopic(doc: ProductDoc, topic: string) {
  return doc.sections.filter((section) => {
    const haystack = [
      section.heading,
      ...(section.body ?? []),
      ...(section.bullets ?? [])
    ].join('\n').toLowerCase();
    return haystack.includes(topic);
  });
}

export function readProductDocByTopic(doc: ProductDoc, topic?: string, language: AppLanguage = 'zh-CN') {
  const normalizedTopic = normalizeProductDocTopic(topic);
  if (!normalizedTopic) {
    return {
      summary: language === 'zh-CN'
        ? '已读取 Polaris 产品知识章节索引'
        : 'Read the Polaris product knowledge chapter index',
      detailText: formatProductDocIndexAsMarkdown(doc, language)
    };
  }

  if (shouldReadFullProductDoc(normalizedTopic)) {
    return {
      summary: language === 'zh-CN'
        ? '已读取 Polaris 产品知识全文'
        : 'Read the full Polaris product knowledge document',
      detailText: formatProductDocAsMarkdown(doc, language)
    };
  }

  const matchedSections = filterProductDocSectionsByTopic(doc, normalizedTopic);

  if (!matchedSections.length) {
    return {
      summary: language === 'zh-CN'
        ? `未找到“${topic?.trim()}”的精确章节，已返回 Polaris 产品知识章节索引`
        : `No exact chapter found for "${topic?.trim()}"; returned the Polaris product knowledge chapter index`,
      detailText: formatProductDocIndexAsMarkdown(doc, language)
    };
  }

  return {
    summary: language === 'zh-CN'
      ? `已读取 Polaris 产品知识 · ${matchedSections.map((section) => section.heading).join('、')}`
      : `Read Polaris product knowledge · ${matchedSections.map((section) => section.heading).join(', ')}`,
    detailText: formatProductDocAsMarkdown({
      ...doc,
      summary: language === 'zh-CN'
        ? `${doc.summary}（已按主题筛选）`
        : `${doc.summary} (filtered by topic)`,
      sections: matchedSections
    }, language)
  };
}
