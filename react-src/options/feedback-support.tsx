import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createReactRootController, type ReactRootController } from './root-controller';

export interface FeedbackSupportQr {
  alt: string;
  closeLabel: string;
  imageUrl: string;
  title: string;
}

export interface FeedbackSupportItem {
  href: string;
  iconClass: string;
  key: string;
  label: string;
  labelKey: string;
  /** Shows this QR code in a popover instead of opening the link. */
  qr?: FeedbackSupportQr | null;
}

export interface FeedbackSupportRowCopy {
  description: string;
  descriptionKey: string;
  title: string;
  titleKey: string;
}

export interface FeedbackSupportHelp extends FeedbackSupportRowCopy {
  href: string;
  label: string;
  labelKey: string;
}

export interface FeedbackSupportRenderModel {
  contact: FeedbackSupportRowCopy;
  heading: string;
  headingKey: string;
  help?: FeedbackSupportHelp | null;
  items: FeedbackSupportItem[];
}

export type FeedbackSupportController =
  ReactRootController<FeedbackSupportRenderModel>;

const ACTION_CLASS = '_x_extension_shortcut_submit_2024_unique_ _x_extension_feedback_support_action_2026_unique_';

// Laid out like every other setting: title and description on the left, quiet actions on the right.
function FeedbackSupportRow({ children, copy }: { children: ReactNode; copy: FeedbackSupportRowCopy }) {
  return (
    <div className="_x_extension_setting_row_2024_unique_ _x_extension_feedback_support_row_2026_unique_">
      <div className="_x_extension_feedback_support_copy_2026_unique_">
        <p className="_x_extension_setting_title_2024_unique_" data-i18n={copy.titleKey}>
          {copy.title}
        </p>
        <p className="_x_extension_setting_desc_2024_unique_" data-i18n={copy.descriptionKey}>
          {copy.description}
        </p>
      </div>
      {children}
    </div>
  );
}

function FeedbackSupportQrButton({ item, qr }: { item: FeedbackSupportItem; qr: FeedbackSupportQr }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverId = `_x_extension_feedback_support_qr_${item.key}_2026_unique_`;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open]);

  return (
    <div className="_x_extension_feedback_support_qr_anchor_2026_unique_" ref={rootRef}>
      <button
        aria-controls={popoverId}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="dialog"
        className={ACTION_CLASS}
        data-feedback-support={item.key}
        data-open={open ? 'true' : 'false'}
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      >
        <i className={`ri-icon ri-size-14 ${item.iconClass}`} aria-hidden="true" />
        <span data-i18n={item.labelKey}>{item.label}</span>
      </button>
      <div
        aria-hidden={open ? undefined : 'true'}
        aria-label={qr.title}
        className="_x_extension_menu_surface_2024_unique_ _x_extension_feedback_support_qr_popover_2026_unique_"
        data-open={open ? 'true' : 'false'}
        id={popoverId}
        role="dialog"
      >
        <div className="_x_extension_feedback_support_qr_header_2026_unique_">
          <p>{qr.title}</p>
          <button
            aria-label={qr.closeLabel}
            className="_x_extension_feedback_support_qr_close_2026_unique_"
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
            tabIndex={open ? 0 : -1}
            type="button"
          >
            <i className="ri-icon ri-size-16 ri-close-line" aria-hidden="true" />
          </button>
        </div>
        <img
          alt={qr.alt}
          className="_x_extension_feedback_support_qr_image_2026_unique_"
          height="1596"
          loading="lazy"
          src={qr.imageUrl}
          width="1080"
        />
      </div>
    </div>
  );
}

function FeedbackSupportView({ contact, heading, headingKey, help, items }: FeedbackSupportRenderModel) {
  return (
    <section
      className="_x_extension_feedback_support_section_2026_unique_"
      aria-labelledby="_x_extension_feedback_support_heading_2026_unique_"
    >
      <div className="_x_extension_setting_row_2024_unique_ _x_extension_section_header_2026_unique_">
        <h2
          id="_x_extension_feedback_support_heading_2026_unique_"
          className="_x_extension_section_title_2024_unique_"
          data-i18n={headingKey}
        >
          {heading}
        </h2>
      </div>
      {help?.href ? (
        <FeedbackSupportRow copy={help}>
          <a
            className={ACTION_CLASS}
            data-feedback-support="help-center"
            href={help.href}
            rel="noreferrer noopener"
            target="_blank"
          >
            <span data-i18n={help.labelKey}>{help.label}</span>
            <i className="ri-icon ri-size-14 ri-external-link-line" aria-hidden="true" />
          </a>
        </FeedbackSupportRow>
      ) : null}
      <FeedbackSupportRow copy={contact}>
        <nav
          className="_x_extension_feedback_support_links_2026_unique_"
          aria-label={contact.title}
        >
          {items.map((item) => item.qr ? (
            <FeedbackSupportQrButton item={item} key={item.key} qr={item.qr} />
          ) : (
            <a
              key={item.key}
              className={ACTION_CLASS}
              data-feedback-support={item.key}
              href={item.href}
              rel="noreferrer noopener"
              target="_blank"
            >
              <i className={`ri-icon ri-size-14 ${item.iconClass}`} aria-hidden="true" />
              <span data-i18n={item.labelKey}>{item.label}</span>
            </a>
          ))}
        </nav>
      </FeedbackSupportRow>
    </section>
  );
}

export function createFeedbackSupportController(
  host: HTMLElement | null
): FeedbackSupportController {
  if (host) {
    host.dataset.reactIsland = 'options-feedback-support';
  }
  return createReactRootController(host, (model) => (
    <FeedbackSupportView {...model} />
  ));
}

export function createFeedbackSupportApi() {
  return Object.freeze({
    implementation: 'react' as const,
    createFeedbackSupportController
  });
}
