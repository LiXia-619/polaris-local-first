import { HelpHint } from '../../HelpHint';
import { useI18n } from '../../../i18n';

type CollectionShelfLeadProps = {
  title?: string;
  meta?: string;
  className?: string;
  helpText?: string;
};

export function CollectionShelfLead({
  title,
  meta,
  className,
  helpText
}: CollectionShelfLeadProps) {
  const { t } = useI18n();
  const helpLabel = title ?? meta ?? t('collection.nav.info');

  return (
    <div
      className={[
        'collection-shelf-lead',
        'collection-shelf-lead--without-action',
        className
      ].filter(Boolean).join(' ')}
    >
      <div className="collection-shelf-lead-main">
        {title ? (
          <div className="collection-shelf-lead-copy">
            <strong className="collection-shelf-lead-title">
              {title}
              {helpText ? (
                <HelpHint
                  className="help-hint--inline-title"
                  label={helpLabel}
                  text={helpText}
                />
              ) : null}
            </strong>
          </div>
        ) : null}
      </div>
      {meta ? (
        <span className="collection-shelf-lead-meta-cluster">
          <span className="collection-shelf-lead-meta">{meta}</span>
          {!title && helpText ? (
            <HelpHint
              className="help-hint--shelf-meta"
              label={helpLabel}
              text={helpText}
            />
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
