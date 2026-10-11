import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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

export interface FeedbackSupportAskDemoResult {
  detail: string;
  title: string;
}

/** The hover demo of asking the Help Center from the search box: lm, Tab, then a question. */
export interface FeedbackSupportAskDemo {
  caption: string;
  captionKey: string;
  iconUrl: string;
  label: string;
  labelKey: string;
  prefix: string;
  providerName: string;
  query: string;
  results: FeedbackSupportAskDemoResult[];
}

export interface FeedbackSupportHelp extends FeedbackSupportRowCopy {
  ask?: FeedbackSupportAskDemo | null;
  href: string;
  label: string;
  labelKey: string;
}

export interface FeedbackSupportRenderModel {
  heading: string;
  headingKey: string;
  help?: FeedbackSupportHelp | null;
  items: FeedbackSupportItem[];
}

export type FeedbackSupportController =
  ReactRootController<FeedbackSupportRenderModel>;

const ACTION_CLASS = '_x_extension_shortcut_submit_2024_unique_ _x_extension_feedback_support_action_2026_unique_';
const TILE_CLASS = '_x_extension_feedback_support_link_2026_unique_';

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
        className={TILE_CLASS}
        data-feedback-support={item.key}
        data-open={open ? 'true' : 'false'}
        onClick={() => setOpen((value) => !value)}
        ref={buttonRef}
        type="button"
      >
        <i className={`ri-icon ri-size-16 ${item.iconClass}`} aria-hidden="true" />
        <span data-i18n={item.labelKey}>{item.label}</span>
        <i className="ri-icon ri-size-14 ri-qr-code-line" aria-hidden="true" />
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

type AskDemoPhase = 'idle' | 'prefix' | 'tab' | 'question' | 'results';

interface AskDemoFrame {
  chars: number;
  duration: number;
  phase: AskDemoPhase;
}

// One loop of the demo: type the keyword, press Tab, type the question, then show the pages.
export function buildAskDemoFrames(prefix: string, query: string): AskDemoFrame[] {
  const prefixChars = Array.from(prefix);
  const queryChars = Array.from(query);
  const queryStep = Math.max(50, Math.min(130, Math.round(1500 / Math.max(1, queryChars.length))));
  return [
    { phase: 'idle', chars: 0, duration: 700 },
    ...prefixChars.map((_, index) => ({ phase: 'prefix' as const, chars: index + 1, duration: 200 })),
    { phase: 'tab', chars: prefixChars.length, duration: 700 },
    { phase: 'question', chars: 0, duration: 450 },
    ...queryChars.map((_, index) => ({ phase: 'question' as const, chars: index + 1, duration: queryStep })),
    { phase: 'results', chars: queryChars.length, duration: 2800 }
  ];
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function FeedbackSupportAskDemoView({ demo, playing }: { demo: FeedbackSupportAskDemo; playing: boolean }) {
  const frames = useMemo(() => buildAskDemoFrames(demo.prefix, demo.query), [demo.prefix, demo.query]);
  const [frameIndex, setFrameIndex] = useState(0);
  const reducedMotion = useMemo(prefersReducedMotion, []);

  useEffect(() => {
    if (!playing || reducedMotion) {
      setFrameIndex(reducedMotion ? frames.length - 1 : 0);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setFrameIndex((index) => (index + 1) % frames.length);
    }, frames[frameIndex]?.duration ?? 400);
    return () => window.clearTimeout(timer);
  }, [frameIndex, frames, playing, reducedMotion]);

  const frame = frames[Math.min(frameIndex, frames.length - 1)];
  const inProvider = frame.phase === 'question' || frame.phase === 'results';
  const text = inProvider
    ? Array.from(demo.query).slice(0, frame.chars).join('')
    : Array.from(demo.prefix).slice(0, frame.chars).join('');

  return (
    <div className="_x_extension_help_ask_demo_2026_unique_" data-phase={frame.phase} aria-hidden="true">
      <div className="_x_extension_help_ask_demo_field_2026_unique_">
        <i className="ri-icon ri-size-14 ri-search-line" />
        {inProvider ? (
          <span className="_x_extension_help_ask_demo_chip_2026_unique_">
            <img alt="" src={demo.iconUrl} />
            <span>{demo.providerName}</span>
          </span>
        ) : null}
        <span className="_x_extension_help_ask_demo_text_2026_unique_">
          <span>
            {text}
            <span className="_x_extension_help_ask_demo_caret_2026_unique_" />
          </span>
        </span>
        <kbd
          className="_x_extension_help_ask_demo_key_2026_unique_"
          data-visible={frame.phase === 'prefix' || frame.phase === 'tab' ? 'true' : 'false'}
          data-pressed={frame.phase === 'tab' ? 'true' : 'false'}
        >
          Tab
        </kbd>
      </div>
      {/* Placeholder rows hold the space while the question is typed; the pages fade in over them. */}
      <div
        className="_x_extension_help_ask_demo_results_2026_unique_"
        data-visible={frame.phase === 'results' ? 'true' : 'false'}
      >
        <ul className="_x_extension_help_ask_demo_skeleton_2026_unique_">
          {demo.results.map((result) => (
            <li key={result.title}>
              <span />
              <span className="_x_extension_help_ask_demo_result_title_2026_unique_" />
              <span className="_x_extension_help_ask_demo_result_detail_2026_unique_" />
            </li>
          ))}
        </ul>
        <ul className="_x_extension_help_ask_demo_list_2026_unique_">
          {demo.results.map((result, index) => (
            <li key={result.title} style={{ '--help-ask-demo-row': index } as CSSProperties}>
              <img alt="" src={demo.iconUrl} />
              <span className="_x_extension_help_ask_demo_result_title_2026_unique_">{result.title}</span>
              <span className="_x_extension_help_ask_demo_result_detail_2026_unique_">{result.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Hover or focus shows how to ask the Help Center from the search box, playing while open.
function FeedbackSupportAskHint({ demo }: { demo: FeedbackSupportAskDemo }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef(0);
  const popoverId = '_x_extension_help_ask_popover_2026_unique_';

  const schedule = (next: boolean, delay: number) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setOpen(next), delay);
  };

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.clearTimeout(timerRef.current);
        setOpen(false);
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        window.clearTimeout(timerRef.current);
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [open]);

  return (
    <div
      className="_x_extension_help_ask_anchor_2026_unique_"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          schedule(false, 0);
        }
      }}
      onFocus={() => schedule(true, 0)}
      onMouseEnter={() => schedule(true, 120)}
      onMouseLeave={() => schedule(false, 160)}
      ref={rootRef}
    >
      <button
        aria-controls={popoverId}
        aria-describedby={popoverId}
        aria-expanded={open ? 'true' : 'false'}
        className={ACTION_CLASS}
        data-feedback-support="help-center-ask"
        data-open={open ? 'true' : 'false'}
        onClick={() => {
          window.clearTimeout(timerRef.current);
          setOpen((value) => !value);
        }}
        type="button"
      >
        <i className="ri-icon ri-size-14 ri-chat-search-line" aria-hidden="true" />
        <span data-i18n={demo.labelKey}>{demo.label}</span>
      </button>
      <div
        className="_x_extension_menu_surface_2024_unique_ _x_extension_help_ask_popover_2026_unique_"
        data-open={open ? 'true' : 'false'}
        id={popoverId}
        role="tooltip"
      >
        <FeedbackSupportAskDemoView demo={demo} playing={open} />
        <p className="_x_extension_help_ask_caption_2026_unique_" data-i18n={demo.captionKey}>
          {demo.caption}
        </p>
      </div>
    </div>
  );
}

function FeedbackSupportView({ heading, headingKey, help, items }: FeedbackSupportRenderModel) {
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
          {help.ask ? <FeedbackSupportAskHint demo={help.ask} /> : null}
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
      <nav
        className="_x_extension_feedback_support_links_2026_unique_"
        aria-labelledby="_x_extension_feedback_support_heading_2026_unique_"
      >
        {items.map((item) => item.qr ? (
          <FeedbackSupportQrButton item={item} key={item.key} qr={item.qr} />
        ) : (
          <a
            key={item.key}
            className={TILE_CLASS}
            data-feedback-support={item.key}
            href={item.href}
            rel="noreferrer noopener"
            target="_blank"
          >
            <i className={`ri-icon ri-size-16 ${item.iconClass}`} aria-hidden="true" />
            <span data-i18n={item.labelKey}>{item.label}</span>
            <i className="ri-icon ri-size-14 ri-external-link-line" aria-hidden="true" />
          </a>
        ))}
      </nav>
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
