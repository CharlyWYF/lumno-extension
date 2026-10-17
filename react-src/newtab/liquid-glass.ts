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
// feDisplacementMap moves a pixel by up to half the scale, so the rim samples up to 6px inward,
// under half the rim even in the bluest channel: the scene stretches out toward the edge but
// never folds back on itself. A bend past the rim mirrors the scene there, and the fold leaves a
// hard seam inside it.
export const LIQUID_GLASS_DISPLACEMENT_SCALE = 12;
// Blue bends further than red: each channel samples the backdrop at its own share of the bend, so
// the rim fringes where the wallpaper has edges. Nothing splits in the flat middle.
export const LIQUID_GLASS_DISPERSION = 0.25;
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

// The bend is strongest at the edge and eases out to nothing at the rim's inner edge, with no
// slope left there, so the rim melts into the flat middle without a visible line.
function rimStrength(progressFromRim: number) {
  const rest = 1 - Math.min(1, progressFromRim);
  return rest * rest;
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

// Too small a surface has no flat middle to look through, so it goes without a lens.
const LENS_MIN_PX = 32;

const at = (rect: Rect) => `x="${rect[0]}" y="${rect[1]}" width="${rect[2]}" height="${rect[3]}"`;

// The filter. The map is the lens tiles over a flat flood; the backdrop is displaced by it once, or
// once per color channel, each by its own scale, the three channels added back together (screen on
// single channels is a sum). Every pass covers the whole surface: Chrome 155 draws displacement
// passes held to a primitive subregion wrong over a backdrop (parts left unblurred, rims lit), so
// limiting the passes to the rim is not an option.
export function buildLensFilter(
  id: string,
  width: number,
  height: number,
  tiles: LensTiles,
  scale: number,
  dispersion: boolean
) {
  const tileRects = getLensLayout(tiles.shape, width, height, tiles.size);
  const pieces = tileRects.map((rect, index) =>
    `<feImage href="${tiles.urls[index]}" preserveAspectRatio="none" ${at(rect)} result="t${index}"/>`);
  const pass = (channelScale: number) =>
    '<feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G" ' +
    `scale="${channelScale.toFixed(1)}"`;
  const bend = dispersion
    ? 'rgb'.split('').map((name, index) => `${pass(scale * (1 + (index - 1) * LIQUID_GLASS_DISPERSION))}/>` +
      // Keeps this channel and alpha only: a 1 on the diagonal of the 4x5 color matrix.
      `<feColorMatrix type="matrix" values="${Array.from({ length: 20 }, (_, cell) =>
        Number(cell === index * 6 || cell === 18)).join(' ')}" result="${name}"/>`).join('') +
      '<feBlend in="r" in2="g" mode="screen"/><feBlend in2="b" mode="screen"/>'
    : `${pass(scale)}/>`;
  return `<filter id="${id}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB" ` +
    `x="0" y="0" width="${width}" height="${height}">` +
    `<feFlood flood-color="rgb(128,128,128)" result="flat"/>${pieces.join('')}` +
    `<feMerge result="map"><feMergeNode in="flat"/>${tileRects.map((_rect, index) =>
      `<feMergeNode in="t${index}"/>`).join('')}</feMerge>${bend}</filter>`;
}

// Fits a lens filter to a new size by moving its tiles; the images stay as they are.
export function placeLensFilter(filter: Element, width: number, height: number, tiles: LensTiles) {
  filter.setAttribute('width', String(width));
  filter.setAttribute('height', String(height));
  const tileRects = getLensLayout(tiles.shape, width, height, tiles.size);
  filter.querySelectorAll('feImage').forEach((piece, index) => {
    ['x', 'y', 'width', 'height'].forEach((name, at) => piece.setAttribute(name, String(tileRects[index][at])));
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
      dispersion: boolean
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
        // Numbered across every lens on the page: url(#id) takes the first element with an id, so a
        // repeated id would give every surface the first surface's lens.
        const filterId = `${idPrefix}_${(filterCount += 1)}_2026_unique_`;
        const host = createFilterHost(
          documentObj,
          buildLensFilter(filterId, nextWidth, nextHeight, tiles, scale, dispersion)
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
          idPrefix: '_x_extension_newtab_liquid_glass',
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

// The ring around a New Tab plate: a fifth of its height on the search bar, so most of the plate
// stays a clear, flat window.
const SURFACE_BEZEL_PX = 14;

// Rim width for a surface of this size, narrowed so small plates keep a flat middle.
export function getSurfaceBezel(width: number, height: number) {
  return Math.max(4, Math.min(SURFACE_BEZEL_PX, Math.min(width, height) / 4));
}

// How far the rim moves the backdrop: the bar's bend per pixel of rim.
export function getSurfaceDisplacementScale(bezel: number) {
  return Math.round((LIQUID_GLASS_DISPLACEMENT_SCALE * bezel) / BEZEL_PX);
}

function readCornerRadius(style: CSSStyleDeclaration, width: number, height: number) {
  const value = String(style.borderTopLeftRadius || '0').split(' ')[0];
  const amount = Number.parseFloat(value) || 0;
  return value.endsWith('%') ? (amount / 100) * Math.min(width, height) : amount;
}

export interface LiquidSurfaces {
  destroy(): void;
  refresh(): void;
}

// Gives every element matching `selector` a rim-refraction filter in the inline custom property
// `property`. Only surfaces matching `dispersionSelector` split the bend into colors; each costs
// three displacement passes instead of one. A surface may
// set its own rim width in the CSS property `rimProperty`, held whatever its size (narrowed only
// on a surface too short for it), so a plate that grows keeps one lens instead of a new one at
// every step. Sizes are followed from a ResizeObserver, which runs after layout and before paint,
// so a surface's lens fits its new size in the frame it changes.
export function createLiquidSurfaces(options: {
  documentObj: Document;
  dispersionSelector?: string;
  property: string;
  rimProperty?: string;
  selector: string;
  windowObj: Window;
}): LiquidSurfaces {
  const { documentObj, dispersionSelector, property, rimProperty, selector, windowObj } = options;
  const supported = isLiquidGlassSupported(windowObj);
  const idPrefix = '_x_extension_newtab_liquid_surface';
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
    const style = windowObj.getComputedStyle(element);
    const radius = Math.round(Math.min(readCornerRadius(style, width, height), width / 2, height / 2));
    // The rim width the surface sets for itself, in px; none leaves it to getSurfaceBezel.
    const rim = rimProperty ? Number.parseFloat(style.getPropertyValue(rimProperty)) : 0;
    const bezel = Math.round(rim > 0 ? Math.min(rim, Math.min(width, height) / 2) : getSurfaceBezel(width, height));
    const dispersion = Boolean(dispersionSelector && element.matches(dispersionSelector));
    lens.update(`${radius}:${bezel}:${dispersion ? 'rgb' : 'g'}`, 'floating', radius, bezel,
      getSurfaceDisplacementScale(bezel), dispersion);
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
