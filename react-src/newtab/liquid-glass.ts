// Liquid glass: the wallpaper behind a surface's rim bends inward the way a thick glass edge
// refracts, and splits slightly into its colors there. An SVG displacement map drives the bend
// through `backdrop-filter: url(#…)`, which only Chromium renders; other browsers keep the CSS-only
// glass. The bookmarks bar drives one surface; New Tab's glass style drives many through
// createLiquidSurfaces.
//
// The map is a nine-slice lens. Only the rim bends, and a rim depends on the corner radius and rim
// width alone, so a lens is four corner tiles and four one-pixel edge strips (stretched along the
// sides), on a flat flood. The tiles are built and decoded once per radius and rim and shared by
// every surface; a surface that resizes only moves its tiles, in the same frame, so nothing is
// rebuilt, encoded or decoded while the page resizes or the results plate grows.

const BEZEL_PX = 16;
// feDisplacementMap moves a pixel by up to half the scale, so the rim samples up to 24px inward:
// one and a half rims, so the outer edge shows the scene from past the rim, flipped and squeezed.
export const LIQUID_GLASS_DISPLACEMENT_SCALE = 48;
// Blue bends further than red: each channel samples the backdrop at its own share of the bend, so
// the rim fringes where the wallpaper has edges. Nothing splits in the flat middle.
export const LIQUID_GLASS_DISPERSION = 0.2;
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

// Pure refraction puts nearly all of the bend in the outer few pixels, too thin to read; part of
// it is spread over the whole rim as a smooth falloff, so the scene visibly squeezes toward the edge.
function rimStrength(progressFromRim: number) {
  if (progressFromRim >= 1) {
    return 0;
  }
  const rest = 1 - progressFromRim;
  return 0.4 * (rimShift(progressFromRim) / RIM_EDGE_SHIFT) + 0.6 * rest * rest;
}

export interface LensTiles {
  shape: LiquidGlassShape;
  size: number;
  urls: string[];
}

type Rect = [number, number, number, number];

// Where each tile of a lens sits on a surface of this size: corners (top left, top right, bottom
// left, bottom right) then edges (top, bottom, left, right); a docked bar has its bottom edge only.
export function getLensLayout(shape: LiquidGlassShape, width: number, height: number, size: number): Rect[] {
  if (shape === 'docked') {
    return [[0, height - size, width, size]];
  }
  const across = Math.max(1, width - size * 2);
  const down = Math.max(1, height - size * 2);
  return [
    [0, 0, size, size],
    [width - size, 0, size, size],
    [0, height - size, size, size],
    [width - size, height - size, size, size],
    [size, 0, across, size],
    [size, height - size, across, size],
    [0, size, size, down],
    [width - size, size, size, down]
  ];
}

// The tiles' pixels, read off a probe surface one pixel wider than two tiles: its rims bend as
// any surface at least twice the tile size does, and its edges are the one-pixel strips.
export function getLensTilePixels(shape: LiquidGlassShape, radius: number, bezel: number) {
  const size = Math.max(1, Math.ceil(shape === 'docked' ? bezel : Math.max(radius, bezel)));
  const probe = size * 2 + 1;
  const geometry = { bezel, radius };
  const probeWidth = shape === 'docked' ? 1 : probe;
  return {
    size,
    tiles: getLensLayout(shape, probeWidth, probe, size).map(([left, top, w, h]) => {
      const data = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const [dx, dy] = getRimDisplacement(left + x + 0.5, top + y + 0.5, probeWidth, probe, shape, geometry);
          const offset = (y * w + x) * 4;
          data[offset] = Math.round(128 + dx * 127);
          data[offset + 1] = Math.round(128 + dy * 127);
          data[offset + 2] = 128;
          data[offset + 3] = 255;
        }
      }
      return { width: w, height: h, data };
    })
  };
}

function buildLensTiles(documentObj: Document, shape: LiquidGlassShape, radius: number, bezel: number): LensTiles | null {
  const { size, tiles } = getLensTilePixels(shape, radius, bezel);
  const urls: string[] = [];
  for (const tile of tiles) {
    const canvas = documentObj.createElement('canvas');
    canvas.width = tile.width;
    canvas.height = tile.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    const image = context.createImageData(tile.width, tile.height);
    image.data.set(tile.data);
    context.putImageData(image, 0, 0);
    urls.push(canvas.toDataURL('image/png'));
  }
  return { shape, size, urls };
}

// Lens tiles for one shape, radius and rim, built once and resolved once every tile has decoded,
// so no surface points at a filter whose images are still loading (it would draw without its blur).
function createLensCache(documentObj: Document) {
  const cache = new Map<string, Promise<LensTiles>>();
  return (shape: LiquidGlassShape, radius: number, bezel: number) => {
    const key = `${shape}:${radius}:${bezel}`;
    let entry = cache.get(key);
    if (!entry) {
      const tiles = buildLensTiles(documentObj, shape, radius, bezel);
      entry = tiles
        ? Promise.all(tiles.urls.map((url) => {
          const image = documentObj.createElement('img');
          image.src = url;
          return typeof image.decode === 'function' ? image.decode() : undefined;
        })).then(() => tiles)
        : Promise.reject(new Error('no canvas'));
      entry.catch(() => cache.delete(key));
      cache.set(key, entry);
    }
    return entry;
  };
}

// Only plates get a lens: Chrome redraws every backdrop filter on the page in each frame that
// changes anything, and a lens costs a small control (a shortcut, a round button) more there than
// all its blur does, for a bend hardly visible at that size. Controls keep the rest of the glass.
const LENS_MIN_PX = 64;

// The four bands a rim can bend in (top, bottom, left, right); the middle never moves.
export function getLensBands(width: number, height: number, size: number): Rect[] {
  const down = Math.max(1, height - size * 2);
  return [[0, 0, width, size], [0, height - size, width, size], [0, size, size, down], [width - size, size, size, down]];
}

// Which tiles lie in each band, in getLensLayout order.
const BAND_TILES = [[0, 4, 1], [2, 5, 3], [6], [7]];

// A plate whose rim covers less than 60% of it bends in its bands only: the filter's passes then
// cover a quarter of a results plate, half a card, and the middle passes through as it is.
export function usesLensBands(width: number, height: number, size: number) {
  return size * 2 * (width + height - size * 2) < width * height * 0.6;
}

const at = (rect: Rect) => `x="${rect[0]}" y="${rect[1]}" width="${rect[2]}" height="${rect[3]}"`;

// The filter. The map is the lens tiles over a flat flood; the backdrop is displaced by it once, or
// once per color channel, each by its own scale, the three channels added back together (screen on
// single channels is a sum). With bands, each band builds its own map and bend inside its own
// subregion, and the bands are laid over the untouched backdrop.
export function buildLensFilter(
  id: string,
  width: number,
  height: number,
  tiles: LensTiles,
  scale: number,
  dispersion: boolean,
  bands = false
) {
  const tileRects = getLensLayout(tiles.shape, width, height, tiles.size);
  const pieces = tileRects.map((rect, index) =>
    `<feImage href="${tiles.urls[index]}" preserveAspectRatio="none" data-tile="${index}" ${at(rect)} result="t${index}"/>`);
  const bend = (map: string, region: string, result: string) => {
    const pass = (channelScale: number) =>
      `<feDisplacementMap in="SourceGraphic" in2="${map}" xChannelSelector="R" yChannelSelector="G" ${region}` +
      `scale="${channelScale.toFixed(1)}"`;
    return dispersion
      ? 'rgb'.split('').map((name, index) => `${pass(scale * (1 + (index - 1) * LIQUID_GLASS_DISPERSION))}/>` +
        // Keeps this channel and alpha only: a 1 on the diagonal of the 4x5 color matrix.
        `<feColorMatrix type="matrix" values="${Array.from({ length: 20 }, (_, cell) =>
          Number(cell === index * 6 || cell === 18)).join(' ')}" result="${result}${name}"/>`).join('') +
        `<feBlend in="${result}r" in2="${result}g" mode="screen"/><feBlend in2="${result}b" mode="screen" result="${result}"/>`
      : `${pass(scale)} result="${result}"/>`;
  };
  const merge = (nodes: string[], extra = '') =>
    `<feMerge ${extra}>${nodes.map((node) => `<feMergeNode in="${node}"/>`).join('')}</feMerge>`;
  const flood = (extra: string, result: string) => `<feFlood flood-color="rgb(128,128,128)" ${extra} result="${result}"/>`;
  const body = bands
    ? getLensBands(width, height, tiles.size).map((rect, band) => {
      const region = `data-band="${band}" ${at(rect)} `;
      return flood(region, `f${band}`) +
        merge([`f${band}`, ...BAND_TILES[band].map((tile) => `t${tile}`)], `${region}result="m${band}"`) +
        bend(`m${band}`, region, `b${band}`);
    }).join('') + merge(['SourceGraphic', 'b0', 'b1', 'b2', 'b3'])
    : flood('', 'flat') + merge(['flat', ...tileRects.map((_rect, index) => `t${index}`)], 'result="map"') +
      bend('map', '', 'lens');
  return `<filter id="${id}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB" ` +
    `x="0" y="0" width="${width}" height="${height}">${pieces.join('')}${body}</filter>`;
}

// Fits a lens filter to a new size by moving its tiles and bands; the images stay as they are.
export function placeLensFilter(filter: Element, width: number, height: number, tiles: LensTiles) {
  filter.setAttribute('width', String(width));
  filter.setAttribute('height', String(height));
  const tileRects = getLensLayout(tiles.shape, width, height, tiles.size);
  const bandRects = getLensBands(width, height, tiles.size);
  filter.querySelectorAll('[data-tile], [data-band]').forEach((primitive) => {
    const tile = primitive.getAttribute('data-tile');
    const rect = tile === null ? bandRects[Number(primitive.getAttribute('data-band'))] : tileRects[Number(tile)];
    ['x', 'y', 'width', 'height'].forEach((name, index) => primitive.setAttribute(name, String(rect[index])));
  });
}

const svgNamespace = 'http://www.w3.org/2000/svg';

// Each filter gets an <svg> of its own. Adding a filter to an <svg> that holds others can make
// Chrome reload all their images, and a backdrop-filter naming a filter whose images are reloading
// drops its blur too, so one new lens would briefly clear every plate.
function createFilterHost(documentObj: Document, markup: string) {
  const host = documentObj.createElementNS(svgNamespace, 'svg');
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none');
  host.innerHTML = markup;
  (documentObj.body || documentObj.documentElement).appendChild(host);
  return host;
}

// One surface's lens: which tiles it uses and the filter that draws them.
interface Lens {
  key: string;
  host: SVGSVGElement;
  filter: Element;
  tiles: LensTiles;
  width: number;
  height: number;
}

function placeLens(lens: Lens, width: number, height: number) {
  if (lens.width !== width || lens.height !== height) {
    lens.width = width;
    lens.height = height;
    placeLensFilter(lens.filter, width, height, lens.tiles);
  }
}

// Swaps a surface onto a lens for a new key once its tiles have decoded, one frame after the new
// filter is in the document so it never draws before its images; meanwhile the old lens stays.
function createLensSwitcher(options: {
  documentObj: Document;
  windowObj: Window;
  idPrefix: string;
  apply(filterId: string, lens: Lens): void;
  measure(): [number, number];
}) {
  const { documentObj, windowObj, idPrefix, apply, measure } = options;
  const tilesFor = createLensCache(documentObj);
  let serial = 0;
  let wanted = '';
  let current: Lens | null = null;
  let destroyed = false;
  return {
    // Fits the current lens when the key holds, or prepares one for the new key.
    update(
      key: string,
      shape: LiquidGlassShape,
      radius: number,
      bezel: number,
      scale: number,
      dispersion: boolean,
      bands = false
    ) {
      const [width, height] = measure();
      // The current lens follows the size even while a lens for a new key is prepared, so its filter
      // never stops short of the surface.
      if (current) {
        placeLens(current, width, height);
      }
      if (current && current.key === key) {
        wanted = key;
        return;
      }
      if (wanted === key) {
        return;
      }
      wanted = key;
      tilesFor(shape, radius, bezel).then((tiles) => {
        if (destroyed || wanted !== key) {
          return;
        }
        const [nextWidth, nextHeight] = measure();
        const filterId = `${idPrefix}_${(serial += 1)}_2026_unique_`;
        const host = createFilterHost(
          documentObj,
          buildLensFilter(filterId, nextWidth, nextHeight, tiles, scale, dispersion, bands)
        );
        windowObj.requestAnimationFrame(() => {
          if (destroyed || wanted !== key) {
            host.remove();
            return;
          }
          const previous = current;
          current = {
            key,
            host,
            filter: host.firstElementChild as Element,
            tiles,
            width: nextWidth,
            height: nextHeight
          };
          placeLens(current, ...measure());
          apply(filterId, current);
          windowObj.requestAnimationFrame(() => previous?.host.remove());
        });
      }).catch(() => {
        if (wanted === key) {
          wanted = '';
        }
      });
    },
    destroy() {
      destroyed = true;
      wanted = '';
      current?.host.remove();
      current = null;
    }
  };
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

// Keeps the bar's lens matched to its size and shape while the bookmarks bar uses the clear glass
// surface.
export function createLiquidGlass(options: {
  documentObj: Document;
  element: HTMLElement;
  windowObj: Window;
}): LiquidGlass {
  const { documentObj, element, windowObj } = options;
  const supported = isLiquidGlassSupported(windowObj);
  const shapeOf = (): LiquidGlassShape => element.dataset.layout === 'floating' ? 'floating' : 'docked';
  const measure = (): [number, number] => {
    if (element.clientWidth && element.clientHeight) {
      return [Math.round(element.clientWidth), Math.round(element.clientHeight)];
    }
    const viewportWidth = documentObj.documentElement.clientWidth || windowObj.innerWidth || 0;
    return shapeOf() === 'floating'
      ? [Math.round(viewportWidth - FLOATING_SIDE_INSET_PX * 2), FLOATING_HEIGHT_PX]
      : [Math.round(viewportWidth), DOCKED_HEIGHT_PX];
  };
  let lens: ReturnType<typeof createLensSwitcher> | null = null;
  let destroyed = false;

  const disable = () => {
    lens?.destroy();
    lens = null;
    element.removeAttribute('data-liquid-glass');
    element.style.removeProperty('--x-nt-bookmarks-topbar-liquid-filter');
  };

  const isWanted = () =>
    supported &&
    element.dataset.surfaceMode === 'clear' &&
    element.dataset.active === 'true';

  return {
    sync() {
      if (destroyed) {
        return;
      }
      if (!isWanted()) {
        disable();
        return;
      }
      const [width, height] = measure();
      if (width <= 0 || height <= 0) {
        return;
      }
      if (!lens) {
        lens = createLensSwitcher({
          documentObj,
          windowObj,
          idPrefix: `_x_extension_newtab_liquid_glass_${(filterCount += 1)}`,
          measure,
          apply(filterId) {
            element.style.setProperty('--x-nt-bookmarks-topbar-liquid-filter', `url(#${filterId})`);
            element.dataset.liquidGlass = 'true';
          }
        });
      }
      const shape = shapeOf();
      const radius = shape === 'floating' ? Math.round(Math.min(FLOATING_RADIUS_PX, width / 2, height / 2)) : 0;
      const bezel = Math.round(Math.min(BEZEL_PX, height / 2));
      lens.update(`${shape}:${radius}:${bezel}`, shape, radius, bezel, LIQUID_GLASS_DISPLACEMENT_SCALE, false);
    },
    destroy() {
      destroyed = true;
      disable();
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
// `property`. Sizes are followed from a ResizeObserver, which runs after layout and before paint,
// so a surface's lens fits its new size in the frame it changes.
export function createLiquidSurfaces(options: {
  documentObj: Document;
  property: string;
  selector: string;
  windowObj: Window;
}): LiquidSurfaces {
  const { documentObj, property, selector, windowObj } = options;
  const supported = isLiquidGlassSupported(windowObj);
  const idPrefix = `_x_extension_newtab_liquid_surface_${(filterCount += 1)}`;
  const lenses = new Map<HTMLElement, ReturnType<typeof createLensSwitcher>>();
  let destroyed = false;

  const size = (element: HTMLElement): [number, number] =>
    [Math.round(element.offsetWidth), Math.round(element.offsetHeight)];

  const drop = (element: HTMLElement) => {
    lenses.get(element)?.destroy();
    lenses.delete(element);
    element.style.removeProperty(property);
  };

  const update = (element: HTMLElement) => {
    if (destroyed) {
      return;
    }
    if (!element.isConnected || !element.matches(selector)) {
      drop(element);
      resizeObserver?.unobserve(element);
      return;
    }
    const [width, height] = size(element);
    // Hidden (the closed results plate): keep the lens for when it shows again.
    if (width <= 0 || height <= 0) {
      return;
    }
    if (Math.min(width, height) < LENS_MIN_PX) {
      drop(element);
      return;
    }
    let lens = lenses.get(element);
    if (!lens) {
      lens = createLensSwitcher({
        documentObj,
        windowObj,
        idPrefix,
        measure: () => size(element),
        apply: (filterId) => element.style.setProperty(property, `url(#${filterId})`)
      });
      lenses.set(element, lens);
    }
    const radius = Math.round(Math.min(readCornerRadius(element, windowObj, width, height), width / 2, height / 2));
    const bezel = Math.round(getSurfaceBezel(width, height));
    const bands = usesLensBands(width, height, Math.max(radius, bezel));
    lens.update(`${radius}:${bezel}:${bands ? 'bands' : 'full'}`, 'floating', radius, bezel,
      getSurfaceDisplacementScale(bezel), true, bands);
  };

  const ResizeObserverCtor = (windowObj as Window & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  const MutationObserverCtor =
    (windowObj as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
  const resizeObserver = supported && ResizeObserverCtor
    ? new ResizeObserverCtor((entries) => entries.forEach((entry) => update(entry.target as HTMLElement)))
    : null;
  const observeAll = () => documentObj.querySelectorAll<HTMLElement>(selector).forEach((element) => {
    resizeObserver?.observe(element);
  });
  // Only changes that add or remove a surface matter; the clock alone rewrites its digits every second.
  const touchesSurface = (nodes: NodeList) => Array.from(nodes).some((node) =>
    node.nodeType === 1 &&
    ((node as Element).matches(selector) || Boolean((node as Element).querySelector(selector))));
  const mutationObserver = supported && MutationObserverCtor
    ? new MutationObserverCtor((records) => {
      if (records.some((record) => touchesSurface(record.removedNodes))) {
        Array.from(lenses.keys()).filter((element) => !element.isConnected).forEach(drop);
      }
      if (records.some((record) => touchesSurface(record.addedNodes))) {
        observeAll();
      }
    })
    : null;

  if (supported) {
    mutationObserver?.observe(documentObj.body || documentObj.documentElement, { childList: true, subtree: true });
    observeAll();
  }

  return {
    refresh() {
      observeAll();
      lenses.forEach((_lens, element) => update(element));
    },
    destroy() {
      destroyed = true;
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      Array.from(lenses.keys()).forEach(drop);
    }
  };
}
