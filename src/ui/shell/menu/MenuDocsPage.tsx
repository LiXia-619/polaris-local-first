import { useEffect, useMemo, useState } from 'react';
import {
  formatProductDocAsMarkdown,
  getProductDoc,
  getProductDocs,
  type ProductDocId
} from '../../../app/shell/productDocs';
import { useI18n } from '../../../i18n/useI18n';
import { writeTextToClipboard } from '../../../infrastructure/clipboard';
import { Icon } from '../../Icon';

type MenuDocsPageProps = {
  initialDocId?: ProductDocId;
  onBack: () => void;
};

async function copyText(text: string) {
  await writeTextToClipboard(text);
}

export function MenuDocsPage({ initialDocId = 'user-guide', onBack }: MenuDocsPageProps) {
  const { t, language } = useI18n();
  const [selectedDocId, setSelectedDocId] = useState<ProductDocId>(initialDocId);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const standalonePrivacy = initialDocId === 'privacy';
  const productDocDirectory = useMemo(
    () => getProductDocs(language).filter((doc) => doc.id !== 'privacy'),
    [language]
  );
  const selectedDoc = getProductDoc(selectedDocId, language);
  const selectedMarkdown = useMemo(() => formatProductDocAsMarkdown(selectedDoc, language), [language, selectedDoc]);

  useEffect(() => {
    setSelectedDocId(initialDocId);
    setCopyState('idle');
  }, [initialDocId]);

  return (
    <div className="menu-sheet-page menu-docs-page">
      <div className="menu-sheet-header">
        <button type="button" className="menu-sheet-back" aria-label={t('settings.pageBack')} onClick={onBack}>
          <span className="menu-sheet-back-icon"><Icon name="chevron" size={26} /></span>
        </button>
        <div className="menu-sheet-title">
          <small>{standalonePrivacy ? t('settings.section.privacy') : t('settings.docs.section')}</small>
          <h2>{standalonePrivacy ? t('settings.privacy.title') : t('settings.docs.title')}</h2>
        </div>
      </div>

      {!standalonePrivacy ? (
        <section className="menu-section menu-docs-index-section">
          <div className="menu-section-head">
            <span className="menu-section-kicker">{t('settings.docs.contents')}</span>
          </div>
          <div className="menu-doc-list">
            {productDocDirectory.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={`menu-doc-card${doc.id === selectedDocId ? ' active' : ''}`}
                onClick={() => {
                  setSelectedDocId(doc.id);
                  setCopyState('idle');
                }}
              >
                <span>{doc.kicker}</span>
                <strong>{doc.title}</strong>
                <small>{doc.detail}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="menu-section menu-doc-reader-section">
        <div className="menu-doc-reader-head">
          <div>
            <span className="menu-section-kicker">{selectedDoc.kicker}</span>
            <h3>{selectedDoc.title}</h3>
            <p>{selectedDoc.summary}</p>
          </div>
          <button
            type="button"
            className="btn-secondary compact"
            onClick={() => {
              void copyText(selectedMarkdown)
                .then(() => setCopyState('copied'))
                .catch(() => setCopyState('failed'));
            }}
          >
            {copyState === 'copied'
              ? t('settings.docs.copied')
              : copyState === 'failed'
                ? t('settings.docs.copyFailed')
                : t('settings.docs.copy')}
          </button>
        </div>
        <div className="menu-doc-updated">{t('settings.docs.updatedAt', { date: selectedDoc.updatedAt })}</div>
        <article className="menu-doc-body">
          {selectedDoc.sections.map((section) => (
            <section className="menu-doc-section" key={section.heading}>
              <h4>{section.heading}</h4>
              {section.body?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </section>
    </div>
  );
}
