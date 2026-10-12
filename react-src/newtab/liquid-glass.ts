// Liquid glass for the bookmarks bar: the wallpaper behind the bar's rim bends inward the way a
// thick glass edge refracts. An SVG displacement map sized to the bar drives the bend through
// `backdrop-filter: url(#…)`, which only Chromium renders; other browsers keep the CSS-only glass.

const BEZEL_PX = 16;
// feDisplacementMap moves a pixel by up to half the scale, so the rim samples up to 24px inward.
export const LIQUID_GLASS_DISPLACEMENT_SCALE = 48;
const FLOATING_RADIUS_PX = 14;

export type LiquidGlassShape = 'docked' | 'floating';

let filterCount = 0;

export function isLiquidGlassSupported(windowObj: Window) {
  const css = (windowObj as Window & { CSS?: typeof CSS }).CSS;
  const userAgent = String(windowObj.navigator?.userAgent || '');
  // Firefox parses url() in backdrop-filter but draws nothing for it.
  return Boolean(
    css &&
      typeof css.supports === 'function' &&
      css.supports('backdrop-filter', 'url(#a)') &&
      !/Firefox\//.test(userAgent)
  );
}

// Inward offset at a point, as unit direction times strength (0 in the flat middle, 1 at the rim).
export function getRimDisplacement(
  x: number,
  y: number,
  width: number,
  height: number,
  shape: LiquidGlassShape
): [number, number] {
  const bezel = Math.min(BEZEL_PX, height / 2);
  if (shape === 'docked') {
    // The docked bar meets the browser and window at its top and sides; only its bottom edge shows.
    const distance = height - y;
    if (distance >= bezel) {
      return [0, 0];
    }
    return [0, -rimStrength(distance / bezel)];
  }
  const radius = Math.min(FLOATING_RADIUS_PX, width / 2, height / 2);
  const centerX = width / 2;
  const centerY = height / 2;
  const qx = Math.abs(x - centerX) - (centerX - radius);
  const qy = Math.abs(y - centerY) - (centerY - radius);
  let normalX = 0;
  let normalY = 0;
  let distance = 0;
  if (qx > 0 && qy > 0) {
    const length = Math.hypot(qx, qy) || 1;
    normalX = qx / length;
    normalY = qy / length;
    distance = radius - length;
  } else if (qx > qy) {
    normalX = 1;
    distance = radius - qx;
  } else {
    normalY = 1;
    distance = radius - qy;
  }
  if (distance >= bezel) {
    return [0, 0];
  }
  const strength = rimStrength(Math.max(0, distance) / bezel);
  return [
    -normalX * Math.sign(x - centerX || 1) * strength,
    -normalY * Math.sign(y - centerY || 1) * strength
  ];
}

function rimStrength(progressFromRim: number) {
  const t = 1 - Math.min(1, Math.max(0, progressFromRim));
  return Math.pow(t, 1.5);
}

export function buildDisplacementMap(
  documentObj: Document,
  width: number,
  height: number,
  shape: LiquidGlassShape
) {
  const canvas = documentObj.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return '';
  }
  const image = context.createImageData(width, height);
  const { data } = image;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [dx, dy] = getRimDisplacement(x + 0.5, y + 0.5, width, height, shape);
      const offset = (y * width + x) * 4;
      data[offset] = Math.round(128 + dx * 127);
      data[offset + 1] = Math.round(128 + dy * 127);
      data[offset + 2] = 128;
      data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export interface LiquidGlass {
  destroy(): void;
  sync(): void;
}

// The bar's size before it is first shown (it is display: none until then), so its first frame
// already has the glass; the real size replaces the estimate once the bar lays out.
const DOCKED_HEIGHT_PX = 36;
const FLOATING_HEIGHT_PX = 40;
const FLOATING_SIDE_INSET_PX = 12;

// Keeps the bar's filter matched to its size and shape while the bookmarks bar uses the clear glass
// surface. A new map goes into its own filter and the bar switches to it only once the map image has
// decoded, so no frame ever draws with a missing map; the previous filter is dropped afterwards.
export function createLiquidGlass(options: {
  documentObj: Document;
  element: HTMLElement;
  windowObj: Window;
}): LiquidGlass {
  const { documentObj, element, windowObj } = options;
  const supported = isLiquidGlassSupported(windowObj);
  const filterIdPrefix = `_x_extension_newtab_liquid_glass_${(filterCount += 1)}`;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  let svg: SVGSVGElement | null = null;
  let activeFilter: Element | null = null;
  let renderedKey = '';
  let pendingKey = '';
  let renderToken = 0;
  let frameId = 0;
  let destroyed = false;

  const ensureSvg = () => {
    if (!svg) {
      svg = documentObj.createElementNS(svgNamespace, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none');
      (documentObj.body || documentObj.documentElement).appendChild(svg);
    }
    return svg;
  };

  const disable = () => {
    renderToken += 1;
    renderedKey = '';
    pendingKey = '';
    element.removeAttribute('data-liquid-glass');
    element.style.removeProperty('--x-nt-bookmarks-topbar-liquid-filter');
    activeFilter?.remove();
    activeFilter = null;
  };

  const isWanted = () =>
    supported &&
    element.dataset.surfaceMode === 'clear' &&
    element.dataset.active === 'true';

  const measure = (shape: LiquidGlassShape): [number, number] => {
    if (element.clientWidth && element.clientHeight) {
      return [Math.round(element.clientWidth), Math.round(element.clientHeight)];
    }
    const viewportWidth = documentObj.documentElement.clientWidth || windowObj.innerWidth || 0;
    return shape === 'floating'
      ? [Math.round(viewportWidth - FLOATING_SIDE_INSET_PX * 2), FLOATING_HEIGHT_PX]
      : [Math.round(viewportWidth), DOCKED_HEIGHT_PX];
  };

  const render = () => {
    frameId = 0;
    if (destroyed || !isWanted()) {
      disable();
      return;
    }
    const shape: LiquidGlassShape = element.dataset.layout === 'floating' ? 'floating' : 'docked';
    const [width, height] = measure(shape);
    if (width <= 0 || height <= 0) {
      return;
    }
    const key = `${width}x${height}:${shape}`;
    if (key === renderedKey || key === pendingKey) {
      return;
    }
    const map = buildDisplacementMap(documentObj, width, height, shape);
    if (!map) {
      disable();
      return;
    }
    pendingKey = key;
    const token = (renderToken += 1);
    const image = documentObj.createElement('img');
    image.src = map;
    const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
    decoded
      .then(() => {
        if (destroyed || token !== renderToken) {
          return;
        }
        const filterId = `${filterIdPrefix}_${token}_2026_unique_`;
        ensureSvg().insertAdjacentHTML(
          'beforeend',
          `<filter id="${filterId}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB" ` +
            `x="0" y="0" width="${width}" height="${height}">` +
            `<feImage x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" result="map"/>` +
            `<feDisplacementMap in="SourceGraphic" in2="map" scale="${LIQUID_GLASS_DISPLACEMENT_SCALE}" ` +
            'xChannelSelector="R" yChannelSelector="G"/></filter>'
        );
        const filter = svg?.lastElementChild || null;
        filter?.querySelector('feImage')?.setAttribute('href', map);
        // One frame for the filter to take its decoded map before the bar points at it.
        windowObj.requestAnimationFrame(() => {
          if (destroyed || token !== renderToken) {
            filter?.remove();
            return;
          }
          const previous = activeFilter;
          activeFilter = filter;
          renderedKey = key;
          pendingKey = '';
          element.style.setProperty('--x-nt-bookmarks-topbar-liquid-filter', `url(#${filterId})`);
          element.dataset.liquidGlass = 'true';
          windowObj.requestAnimationFrame(() => previous?.remove());
        });
      })
      .catch(() => {
        if (token === renderToken) {
          disable();
        }
      });
  };

  return {
    sync() {
      if (destroyed) {
        return;
      }
      if (!isWanted()) {
        disable();
        return;
      }
      if (frameId) {
        return;
      }
      if (typeof windowObj.requestAnimationFrame !== 'function') {
        render();
        return;
      }
      frameId = windowObj.requestAnimationFrame(render);
    },
    destroy() {
      destroyed = true;
      if (frameId) {
        windowObj.cancelAnimationFrame?.(frameId);
        frameId = 0;
      }
      disable();
      svg?.remove();
      svg = null;
    }
  };
}
