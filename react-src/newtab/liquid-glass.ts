// Liquid glass: the wallpaper behind a surface's rim bends inward the way a thick glass edge
// refracts, and splits slightly into its colors there. An SVG displacement map sized to the surface
// drives the bend through `backdrop-filter: url(#…)`, which only Chromium renders; other browsers
// keep the CSS-only glass.
// The bookmarks bar drives one surface; New Tab's glass style drives many through
// createLiquidSurfaces.

const BEZEL_PX = 16;
// feDisplacementMap moves a pixel by up to half the scale, so the rim samples up to 24px inward:
// one and a half rims, so the outer edge shows the scene from past the rim, flipped and squeezed.
export const LIQUID_GLASS_DISPLACEMENT_SCALE = 48;
// Blue bends further than red: each channel samples the backdrop at its own share of the bend, so
// the rim fringes where the wallpaper has edges. Nothing splits in the flat middle.
export const LIQUID_GLASS_DISPERSION = 0.14;
const FLOATING_RADIUS_PX = 14;

export type LiquidGlassShape = 'docked' | 'floating';

// A floating surface's corner radius and rim width; the bar's own values when left out.
export interface LiquidGlassGeometry {
  bezel?: number;
  radius?: number;
}

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
  shape: LiquidGlassShape,
  geometry: LiquidGlassGeometry = {}
): [number, number] {
  const bezel = Math.min(geometry.bezel ?? BEZEL_PX, height / 2);
  if (shape === 'docked') {
    // The docked bar meets the browser and window at its top and sides; only its bottom edge shows.
    const distance = height - y;
    if (distance >= bezel) {
      return [0, 0];
    }
    return [0, -rimStrength(distance / bezel)];
  }
  const radius = Math.min(geometry.radius ?? FLOATING_RADIUS_PX, width / 2, height / 2);
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

// The rim is the curved shoulder of a glass slab: a convex superellipse that is steep at the edge
// and flattens into the middle. A ray looking straight down refracts through it (Snell, n = 1.5);
// the sideways shift it picks up, scaled so the edge is 1, is the bend at that point.
const REFRACTIVE_INDEX = 1.5;

// Height of the shoulder is (1 - u³)^⅓ with u the remaining way to the flat middle; this is its slope.
function rimShift(progressFromRim: number) {
  const u = 1 - Math.max(1e-3, progressFromRim);
  const normal = Math.atan((u * u) / Math.cbrt(Math.pow(1 - u * u * u, 2)));
  return Math.tan(normal - Math.asin(Math.sin(normal) / REFRACTIVE_INDEX));
}

const RIM_EDGE_SHIFT = rimShift(0);

function rimStrength(progressFromRim: number) {
  return progressFromRim >= 1 ? 0 : rimShift(progressFromRim) / RIM_EDGE_SHIFT;
}

// The filter body: the backdrop is displaced once per color channel, each by its own scale, and the
// three channels are added back together (screen on single channels is a sum).
export function buildRefractionFilter(id: string, width: number, height: number, scale: number) {
  const box = `x="0" y="0" width="${width}" height="${height}"`;
  const channels = 'rgb'.split('').map((name, index) =>
    `<feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" ` +
    `scale="${(scale * (1 + (index - 1) * LIQUID_GLASS_DISPERSION)).toFixed(1)}"/>` +
    // Keeps this channel and alpha only: a 1 on the diagonal of the 4x5 color matrix.
    `<feColorMatrix type="matrix" values="${Array.from({ length: 20 }, (_, cell) =>
      Number(cell === index * 6 || cell === 18)).join(' ')}" result="${name}"/>`);
  return `<filter id="${id}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB" ${box}>` +
    `<feImage ${box} preserveAspectRatio="none" result="map"/>${channels.join('')}` +
    '<feBlend in="r" in2="g" mode="screen"/><feBlend in2="b" mode="screen"/></filter>';
}

export function buildDisplacementMap(
  documentObj: Document,
  width: number,
  height: number,
  shape: LiquidGlassShape,
  geometry: LiquidGlassGeometry = {}
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
      const [dx, dy] = getRimDisplacement(x + 0.5, y + 0.5, width, height, shape, geometry);
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
          buildRefractionFilter(filterId, width, height, LIQUID_GLASS_DISPLACEMENT_SCALE)
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

// New Tab's glass surfaces are thicker than the bookmarks bar: a wider rim, so the bend reaches far
// enough in to read on a calm wallpaper.
const SURFACE_BEZEL_PX = 30;

// Rim width for a surface of this size, narrowed so small controls keep a flat middle.
export function getSurfaceBezel(width: number, height: number) {
  return Math.max(4, Math.min(SURFACE_BEZEL_PX, Math.min(width, height) / 2.2));
}

// How far the rim moves the backdrop: the bar's bend per pixel of rim.
export function getSurfaceDisplacementScale(bezel: number) {
  return Math.round((LIQUID_GLASS_DISPLACEMENT_SCALE * bezel) / BEZEL_PX);
}

function readCornerRadius(element: HTMLElement, windowObj: Window, width: number, height: number) {
  const value = String(windowObj.getComputedStyle(element).borderTopLeftRadius || '0').split(' ')[0];
  const amount = Number.parseFloat(value) || 0;
  return value.endsWith('%') ? (amount / 100) * Math.min(width, height) : amount;
}

export interface LiquidSurfaces {
  destroy(): void;
  refresh(): void;
}

// Gives every element matching `selector` a rim-refraction filter in the inline custom property
// `property`. Surfaces of the same size and radius share one filter, so a page of identical cards
// builds one map; maps no surface uses any more are dropped.
export function createLiquidSurfaces(options: {
  documentObj: Document;
  property: string;
  selector: string;
  windowObj: Window;
}): LiquidSurfaces {
  const { documentObj, property, selector, windowObj } = options;
  const supported = isLiquidGlassSupported(windowObj);
  const filterIdPrefix = `_x_extension_newtab_liquid_surface_${(filterCount += 1)}`;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  // key -> filter id once its map has decoded, or '' while it is decoding.
  const filters = new Map<string, string>();
  const waiting = new Map<string, Set<HTMLElement>>();
  const keys = new Map<HTMLElement, string>();
  // The filter each surface points at right now; it may still be an older size's while the new map
  // decodes, and must outlive that wait: a backdrop-filter naming a missing filter drops its blur too.
  const pointed = new Map<HTMLElement, string>();
  let filterSerial = 0;
  let frameId = 0;
  let destroyed = false;

  // Each filter gets an <svg> of its own. Adding a filter to an <svg> that holds others can make
  // Chrome reload all their maps, and a backdrop-filter naming a filter whose map is reloading
  // drops its blur too, so one new size would briefly (or until the next repaint) clear every plate.
  const createFilterHost = () => {
    const host = documentObj.createElementNS(svgNamespace, 'svg');
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none');
    (documentObj.body || documentObj.documentElement).appendChild(host);
    return host;
  };

  const point = (element: HTMLElement, filterId: string) => {
    element.style.setProperty(property, `url(#${filterId})`);
    pointed.set(element, filterId);
  };

  const build = (key: string, width: number, height: number, radius: number) => {
    filters.set(key, '');
    const bezel = getSurfaceBezel(width, height);
    const map = buildDisplacementMap(documentObj, width, height, 'floating', { bezel, radius });
    if (!map) {
      return;
    }
    const image = documentObj.createElement('img');
    image.src = map;
    const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
    decoded.then(() => {
      if (destroyed || filters.get(key) !== '') {
        return;
      }
      const filterId = `${filterIdPrefix}_${(filterSerial += 1)}_2026_unique_`;
      // Scale with the rim so a small control bends as far, relative to its size, as a card.
      const scale = getSurfaceDisplacementScale(bezel);
      const host = createFilterHost();
      host.insertAdjacentHTML('beforeend', buildRefractionFilter(filterId, width, height, scale));
      host.querySelector('feImage')?.setAttribute('href', map);
      // One frame for the filter to take its decoded map before any surface points at it.
      windowObj.requestAnimationFrame(() => {
        if (destroyed) {
          return;
        }
        filters.set(key, filterId);
        waiting.get(key)?.forEach((element) => {
          if (keys.get(element) === key) {
            point(element, filterId);
          }
        });
        waiting.delete(key);
        dropUnused();
      });
    }).catch(() => {
      filters.delete(key);
    });
  };

  const dropUnused = () => {
    const used = new Set(keys.values());
    const inUse = new Set(pointed.values());
    filters.forEach((filterId, key) => {
      if (!used.has(key) && filterId && !inUse.has(filterId)) {
        documentObj.getElementById(filterId)?.closest('svg')?.remove();
        filters.delete(key);
      }
    });
  };

  const sync = () => {
    frameId = 0;
    if (destroyed) {
      return;
    }
    const current = new Set<HTMLElement>();
    documentObj.querySelectorAll<HTMLElement>(selector).forEach((element) => {
      const width = Math.round(element.offsetWidth);
      const height = Math.round(element.offsetHeight);
      if (width <= 0 || height <= 0) {
        return;
      }
      current.add(element);
      const radius = Math.round(readCornerRadius(element, windowObj, width, height));
      const key = `${width}x${height}r${radius}`;
      if (keys.get(element) === key) {
        return;
      }
      keys.set(element, key);
      const filterId = filters.get(key);
      if (filterId) {
        point(element, filterId);
        return;
      }
      // Keep the previous map until the new one is ready rather than flashing flat glass.
      if (!waiting.has(key)) {
        waiting.set(key, new Set());
      }
      waiting.get(key)?.add(element);
      if (filterId === undefined) {
        build(key, width, height, radius);
      }
    });
    keys.forEach((_key, element) => {
      if (!current.has(element)) {
        keys.delete(element);
        pointed.delete(element);
        element.style.removeProperty(property);
      }
    });
    dropUnused();
  };

  const schedule = () => {
    if (destroyed || frameId) {
      return;
    }
    frameId = windowObj.requestAnimationFrame(sync);
  };

  const ResizeObserverCtor = (windowObj as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const MutationObserverCtor =
    (windowObj as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
  const resizeObserver = supported && ResizeObserverCtor ? new ResizeObserverCtor(schedule) : null;
  // Only changes that add or remove a surface matter; the clock alone rewrites its digits every second.
  const touchesSurface = (nodes: NodeList) => Array.from(nodes).some((node) =>
    node.nodeType === 1 &&
    ((node as Element).matches(selector) || Boolean((node as Element).querySelector(selector))));
  const mutationObserver = supported && MutationObserverCtor
    ? new MutationObserverCtor((records) => {
      if (!records.some((record) => touchesSurface(record.addedNodes) || touchesSurface(record.removedNodes))) {
        return;
      }
      documentObj.querySelectorAll<HTMLElement>(selector).forEach((element) => resizeObserver?.observe(element));
      schedule();
    })
    : null;

  if (supported) {
    mutationObserver?.observe(documentObj.body || documentObj.documentElement, { childList: true, subtree: true });
    documentObj.querySelectorAll<HTMLElement>(selector).forEach((element) => resizeObserver?.observe(element));
    schedule();
  }

  return {
    refresh: schedule,
    destroy() {
      destroyed = true;
      if (frameId) {
        windowObj.cancelAnimationFrame?.(frameId);
        frameId = 0;
      }
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      keys.forEach((_key, element) => element.style.removeProperty(property));
      keys.clear();
      pointed.clear();
      waiting.clear();
      filters.forEach((filterId) => {
        if (filterId) {
          documentObj.getElementById(filterId)?.closest('svg')?.remove();
        }
      });
      filters.clear();
    }
  };
}
