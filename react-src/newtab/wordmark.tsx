import NumberFlow, { NumberFlowGroup } from '@number-flow/react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { CSSProperties } from 'react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

export type NewtabTopContentMode = 'brand' | 'time';

// One of the clock faces from NEWTAB_TIME_FONTS in src/shared/settings.js.
export interface TopContentClockFont {
  colonGap: number;
  colonShift: number;
  family: string;
  id: string;
  stretch: string;
  tracking: number | null;
}

export interface TopContentModel {
  animateEntry: boolean;
  ariaLabel: string;
  font?: TopContentClockFont;
  fontWeight?: number;
  imageSrc: string;
  locale?: string;
  mode: NewtabTopContentMode;
  showSeconds?: boolean;
}

export interface TopContentControllerOptions {
  onActivate(disposition: 'newTab' | 'backgroundTab'): void;
  onEntryAnimationComplete(animationName?: string): void;
}

export interface TopContentController {
  destroy(): void;
  getButton(): HTMLButtonElement | null;
  getContent(): HTMLElement | null;
  getImage(): HTMLImageElement | null;
  getSolid(): HTMLSpanElement | null;
  render(model: TopContentModel): void;
}

const containerStyle = `
  all: unset;
  width: 90vw;
  max-width: var(--x-nt-search-max-width, 720px);
  max-height: 74px;
  min-height: 0;
  margin: 0 0 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  position: relative;
  z-index: 3;
  overflow: hidden;
  pointer-events: auto;
  opacity: 1;
  transform: translate3d(0, 0, 0);
  user-select: none;
`;

const buttonStyle: CSSProperties = {
  alignItems: 'center',
  cursor: 'pointer',
  display: 'inline-flex',
  justifyContent: 'center',
  lineHeight: 0,
  pointerEvents: 'auto',
  position: 'relative'
};

const clockStyle: CSSProperties = {
  alignItems: 'center',
  color: 'var(--x-nt-wordmark-solid-fill, rgb(31 41 55))',
  display: 'inline-flex',
  fontFamily: '"Open Sans", sans-serif',
  fontSize: 'clamp(42px, 4.2vw, 54px)',
  fontStretch: '86%',
  fontVariantNumeric: 'tabular-nums',
  justifyContent: 'center',
  lineHeight: 0.86,
  pointerEvents: 'none',
  position: 'relative',
  textRendering: 'geometricPrecision'
};

const clockDigitsStyle = {
  '--number-flow-mask-height': '0.16em',
  '--number-flow-mask-width': '0.24em'
} as CSSProperties;

// Each face sets these on the clock; the defaults are Open Sans's.
const colonStyle: CSSProperties = {
  display: 'inline-block',
  margin: '0 var(--x-nt-clock-colon-gap, 0.055em)',
  opacity: 0.72,
  transform: 'translateY(var(--x-nt-clock-colon-shift, -0.035em))'
};

const twoDigitFormat = Object.freeze({
  minimumIntegerDigits: 2,
  useGrouping: false
});

const hourDigits = Object.freeze({ 1: Object.freeze({ max: 2 }) });
const minuteDigits = Object.freeze({ 1: Object.freeze({ max: 5 }) });
const CLOCK_LETTER_SPACING_BASE_EM = -0.055;
const CLOCK_LETTER_SPACING_STEP_EM = 0.004;
const CLOCK_LETTER_SPACING_MIN_WEIGHT = 300;
const CLOCK_LETTER_SPACING_WEIGHT_STEP = 100;
const CLOCK_LETTER_SPACING_MAX_STEPS = 5;

function getClockLetterSpacing(fontWeight: number) {
  const spacingSteps = Math.min(
    CLOCK_LETTER_SPACING_MAX_STEPS,
    Math.max(
      0,
      Math.floor(
        (fontWeight - CLOCK_LETTER_SPACING_MIN_WEIGHT) /
          CLOCK_LETTER_SPACING_WEIGHT_STEP
      )
    )
  );
  return `${(
    CLOCK_LETTER_SPACING_BASE_EM +
    spacingSteps * CLOCK_LETTER_SPACING_STEP_EM
  ).toFixed(3)}em`;
}

function getCurrentTime() {
  const now = new Date();
  return {
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds()
  };
}

function getClockDateTime(
  time: { hours: number; minutes: number; seconds: number },
  showSeconds: boolean
) {
  const hours = String(time.hours).padStart(2, '0');
  const minutes = String(time.minutes).padStart(2, '0');
  const seconds = String(time.seconds).padStart(2, '0');
  return showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
}

function createLocalizedTimeFormatter(
  locale: string | undefined,
  showSeconds: boolean
) {
  try {
    const format: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit'
    };
    if (showSeconds) {
      format.second = '2-digit';
    }
    return new Intl.DateTimeFormat(locale || undefined, format);
  } catch (_error) {
    return null;
  }
}

function getLocalizedTimeLabel(
  formatter: Intl.DateTimeFormat | null,
  dateTime: string
) {
  const [hours, minutes, seconds = 0] = dateTime.split(':').map(Number);
  const value = new Date();
  value.setHours(hours, minutes, seconds, 0);
  return formatter ? formatter.format(value) : dateTime;
}

const ClockHourMinuteDigits = memo(function ClockHourMinuteDigits({
  hours,
  locale,
  minutes
}: {
  hours: number;
  locale?: string;
  minutes: number;
}) {
  return (
    <NumberFlowGroup>
      <NumberFlow
        digits={hourDigits}
        format={twoDigitFormat}
        locales={locale}
        style={clockDigitsStyle}
        trend={0}
        value={hours}
      />
      <span style={colonStyle}>:</span>
      <NumberFlow
        digits={minuteDigits}
        format={twoDigitFormat}
        locales={locale}
        style={clockDigitsStyle}
        trend={0}
        value={minutes}
      />
    </NumberFlowGroup>
  );
});

const solidStyle: CSSProperties = {
  background: 'var(--x-nt-wordmark-solid-fill, rgb(31 41 55))',
  contain: 'paint',
  inset: 0,
  mask: 'url("../../assets/images/lumno-wordmark-mask.svg") center / contain no-repeat',
  opacity: 0,
  pointerEvents: 'none',
  position: 'absolute',
  transition: 'background-color 180ms ease, opacity 180ms ease',
  WebkitMask:
    'url("../../assets/images/lumno-wordmark-mask.svg") center / contain no-repeat',
  zIndex: 0
};

const imageStyle: CSSProperties = {
  display: 'block',
  filter: 'none',
  height: 'auto',
  maxWidth: '52%',
  objectFit: 'contain',
  opacity: 0.82,
  position: 'relative',
  transform: 'translateY(0)',
  transition: 'opacity 180ms ease',
  width: 180,
  zIndex: 1
};

function getDisposition(event: {
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
}) {
  return event.ctrlKey || event.metaKey || event.button === 1
    ? 'backgroundTab'
    : 'newTab';
}

function Wordmark({
  model,
  onActivate,
  onEntryAnimationComplete
}: {
  model: TopContentModel;
  onActivate(disposition: 'newTab' | 'backgroundTab'): void;
  onEntryAnimationComplete(animationName?: string): void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const button = buttonRef.current;
    if (!button) {
      return undefined;
    }
    const onAnimationCancel = () => onEntryAnimationComplete();
    button.addEventListener('animationcancel', onAnimationCancel);
    return () => {
      button.removeEventListener('animationcancel', onAnimationCancel);
    };
  }, [onEntryAnimationComplete]);
  return (
    <button
      aria-label={model.ariaLabel}
      className="x-nt-wordmark-content x-nt-wordmark-brand"
      onAnimationEnd={(event) =>
        onEntryAnimationComplete(event.animationName || undefined)
      }
      onAuxClick={(event) => {
        if (event.button !== 1) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onActivate(getDisposition(event));
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onActivate(getDisposition(event));
      }}
      ref={buttonRef}
      style={buttonStyle}
      type="button"
    >
      <span
        aria-hidden="true"
        className="x-nt-wordmark-solid"
        style={solidStyle}
      />
      <img
        alt=""
        className="x-nt-wordmark-image"
        draggable={false}
        height={25.1557}
        src={model.imageSrc}
        style={imageStyle}
        width={112}
      />
    </button>
  );
}

function ClockMark({
  model,
  onEntryAnimationComplete
}: {
  model: TopContentModel;
  onEntryAnimationComplete(animationName?: string): void;
}) {
  const showSeconds = model.showSeconds === true;
  const fontWeight = model.fontWeight ?? 320;
  const font = model.font;
  const fontStyle = font
    ? ({
        fontFamily: font.family,
        fontStretch: font.stretch || 'normal',
        letterSpacing:
          typeof font.tracking === 'number'
            ? `${font.tracking}em`
            : getClockLetterSpacing(fontWeight),
        '--x-nt-clock-colon-gap': `${font.colonGap}em`,
        '--x-nt-clock-colon-shift': `${font.colonShift}em`
      } as CSSProperties)
    : { letterSpacing: getClockLetterSpacing(fontWeight) };
  const [time, setTime] = useState(getCurrentTime);
  const dateTime = getClockDateTime(time, showSeconds);
  const secondsText = String(time.seconds).padStart(2, '0');
  const localizedTimeFormatter = useMemo(
    () => createLocalizedTimeFormatter(model.locale, showSeconds),
    [model.locale, showSeconds]
  );

  useEffect(() => {
    let timer = 0;
    const interval = showSeconds ? 1_000 : 60_000;
    const clearTimer = () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
    };
    const syncTime = () => {
      const nextTime = getCurrentTime();
      setTime((currentTime) => {
        const displayedTimeUnchanged =
          currentTime.hours === nextTime.hours &&
          currentTime.minutes === nextTime.minutes &&
          (!showSeconds || currentTime.seconds === nextTime.seconds);
        return displayedTimeUnchanged ? currentTime : nextTime;
      });
    };
    const scheduleNextTick = () => {
      clearTimer();
      if (document.visibilityState !== 'visible') {
        return;
      }
      const delay = interval - (Date.now() % interval) + 24;
      timer = window.setTimeout(() => {
        timer = 0;
        if (document.visibilityState !== 'visible') {
          return;
        }
        syncTime();
        scheduleNextTick();
      }, delay);
    };
    const handleVisibilityChange = () => {
      clearTimer();
      if (document.visibilityState === 'visible') {
        syncTime();
        scheduleNextTick();
      }
    };
    scheduleNextTick();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showSeconds]);

  return (
    <time
      aria-label={getLocalizedTimeLabel(localizedTimeFormatter, dateTime)}
      className="x-nt-wordmark-content x-nt-time-mark"
      data-show-seconds={showSeconds ? 'true' : 'false'}
      data-time-font={font?.id}
      dateTime={dateTime}
      onAnimationEnd={(event) =>
        onEntryAnimationComplete(event.animationName || undefined)
      }
      style={{
        ...clockStyle,
        ...fontStyle,
        fontWeight
      }}
    >
      <span aria-hidden="true">
        <ClockHourMinuteDigits
          hours={time.hours}
          locale={model.locale}
          minutes={time.minutes}
        />
        {showSeconds ? (
          <>
            <span style={colonStyle}>:</span>
            <span
              className="x-nt-time-seconds-value"
              data-second={time.seconds}
            >
              <span
                className="x-nt-time-seconds-digit"
                data-place="tens"
                key={`tens-${secondsText[0]}`}
                onAnimationEnd={(event) => event.stopPropagation()}
              >
                {secondsText[0]}
              </span>
              <span
                className="x-nt-time-seconds-digit"
                data-place="ones"
                key={`ones-${secondsText[1]}`}
                onAnimationEnd={(event) => event.stopPropagation()}
              >
                {secondsText[1]}
              </span>
            </span>
          </>
        ) : null}
      </span>
    </time>
  );
}

export function createTopContentController(
  host: HTMLElement | null,
  options: TopContentControllerOptions
): TopContentController {
  if (!host) {
    return Object.freeze({
      destroy() {},
      getButton: () => null,
      getContent: () => null,
      getImage: () => null,
      getSolid: () => null,
      render() {}
    });
  }
  host.id = '_x_extension_newtab_wordmark_2026_unique_';
  host.dataset.reactIsland = 'newtab-wordmark';
  host.style.cssText = containerStyle;
  const root: Root = createRoot(host);
  let destroyed = false;
  return Object.freeze({
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      flushSync(() => root.unmount());
    },
    getButton() {
      return host.querySelector('button');
    },
    getContent() {
      return host.querySelector<HTMLElement>('.x-nt-wordmark-content');
    },
    getImage() {
      return host.querySelector('img');
    },
    getSolid() {
      return host.querySelector<HTMLSpanElement>('.x-nt-wordmark-solid');
    },
    render(model: TopContentModel) {
      if (destroyed) {
        return;
      }
      host.dataset.enter = model.animateEntry ? 'run' : 'done';
      flushSync(() => {
        root.render(model.mode === 'time' ? (
          <ClockMark
            key={model.showSeconds === true ? 'seconds' : 'minutes'}
            model={model}
            onEntryAnimationComplete={options.onEntryAnimationComplete}
          />
        ) : (
          <Wordmark
            model={model}
            onActivate={options.onActivate}
            onEntryAnimationComplete={options.onEntryAnimationComplete}
          />
        ));
      });
    }
  });
}

export function createTopContentApi() {
  return Object.freeze({
    implementation: 'react',
    createTopContentController,
    createWordmarkController: createTopContentController
  });
}

// Compatibility aliases for the original brand-only island API.
export type WordmarkModel = TopContentModel;
export type WordmarkControllerOptions = TopContentControllerOptions;
export type WordmarkController = TopContentController;
export const createWordmarkController = createTopContentController;
export const createWordmarkApi = createTopContentApi;
