// B2B Product Populator — fills product cards from built-in catalog. Layer names: product-image, product-title, product-price, etc.

type CurrencyCode = "DHM" | "SAR" | "EGP";

const CURRENCY_SIGNS: Record<CurrencyCode, string> = {
  DHM: "dhm ",
  SAR: "SAR ",
  EGP: "EGP ",
};

const TITLE_LAYER_NAMES = ["product-title", "product-name"];
const REVIEW_LAYER_NAMES = ["product-reviews", "product-review-count"];
const STRIKETHROUGH_PRICE_NAMES = [
  "product-price-strikethrough",
  "product-strikethrough-price",
  "original-price",
];
const DISCOUNT_LAYER_NAMES = ["product-discount", "product-discount-percent"];

interface Product {
  title: string;
  price: number;
  rating: number;
  reviewCount: number;
  thumbnail: string;
  qty?: number;
  description?: string;
  originalPrice?: number;
  discountPercentage?: number;
  brand?: string;
  category?: string;
  sku?: string;
}

async function loadImageFromUrl(
  url: string,
  cache: Map<string, Image>,
): Promise<Image | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  if (!url.startsWith("https://")) return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 8) return null;
    const image = figma.createImage(bytes);
    const size = await image.getSizeAsync();
    if (size && size.width > 0 && size.height > 0) {
      cache.set(url, image);
      return image;
    }
  } catch {}
  return null;
}

type CardCandidate = FrameNode | GroupNode | ComponentNode | InstanceNode;

function isCardCandidate(node: SceneNode): node is CardCandidate {
  return (
    node.type === "FRAME" ||
    node.type === "GROUP" ||
    node.type === "COMPONENT" ||
    node.type === "INSTANCE"
  );
}

function walkDescendants(node: BaseNode, callback: (n: SceneNode) => boolean | void): void {
  if (!("children" in node)) return;
  for (const child of (node as BaseNode & ChildrenMixin).children) {
    const stop = callback(child as SceneNode);
    if (stop === true) return;
    walkDescendants(child, callback);
  }
}

function findChildByName(node: BaseNode & ChildrenMixin, name: string): SceneNode | null {
  const want = name.trim().toLowerCase();
  let result: SceneNode | null = null;
  walkDescendants(node, (n) => {
    if (n.name.trim().toLowerCase() === want) { result = n; return true; }
  });
  return result;
}

function findChildByNames(node: BaseNode & ChildrenMixin, names: string[]): SceneNode | null {
  for (const name of names) {
    const child = findChildByName(node, name);
    if (child) return child;
  }
  return null;
}

function getScopeNodes(): SceneNode[] {
  const selection = figma.currentPage.selection;
  if (selection.length > 0) return selection.slice() as SceneNode[];
  return figma.currentPage.children.slice();
}

function findProductCards(): CardCandidate[] {
  const scope = getScopeNodes();
  const seen = new Set<string>();
  const cards: CardCandidate[] = [];
  const titleNodes: SceneNode[] = [];
  const titleSet = new Set(TITLE_LAYER_NAMES);

  for (const root of scope) {
    if (titleSet.has(root.name.trim().toLowerCase())) titleNodes.push(root);
    walkDescendants(root, (n) => {
      if (titleSet.has(n.name.trim().toLowerCase())) titleNodes.push(n);
    });
  }

  for (const title of titleNodes) {
    let current: BaseNode | null = title.parent;
    while (current) {
      if ("type" in current && isCardCandidate(current as SceneNode)) {
        const container = current as CardCandidate;
        if (!seen.has(container.id)) {
          if (findChildByName(container, "product-image")) {
            seen.add(container.id);
            cards.push(container);
            break;
          }
        } else {
          break;
        }
      }
      current = current.parent;
    }
  }

  cards.sort((a, b) => {
    const ay = a.y ?? 0;
    const by = b.y ?? 0;
    if (Math.abs(ay - by) > 1) return ay - by;
    return (a.x ?? 0) - (b.x ?? 0);
  });
  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomIntInclusive(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (hi < lo) return lo;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function chooseB2BQty(): number {
  // Prefer "comfortable" bulk quantities common in B2B ordering.
  // 70% of the time choose a multiple of 10 (10..100). Otherwise any 1..100.
  if (Math.random() < 0.7) return randomIntInclusive(1, 10) * 10;
  return randomIntInclusive(1, 100);
}

async function ensureFontLoaded(node: TextNode): Promise<void> {
  const fontName = node.fontName;
  if (fontName === figma.mixed) {
    const len = node.characters.length;
    for (let i = 0; i < len; i++) {
      const fn = node.getRangeFontName(i, i + 1) as FontName;
      await figma.loadFontAsync(fn);
    }
    return;
  }
  await figma.loadFontAsync(fontName as FontName);
}

async function applyTextToCard(card: CardCandidate, product: Product, currency: CurrencyCode): Promise<void> {
  const sign = CURRENCY_SIGNS[currency] ?? CURRENCY_SIGNS.DHM;

  const titleNode = findChildByNames(card, TITLE_LAYER_NAMES);
  if (titleNode?.type === "TEXT") { await ensureFontLoaded(titleNode); titleNode.characters = product.title; }

  const qtyNode = findChildByName(card, "product-qty");
  if (qtyNode?.type === "TEXT") {
    await ensureFontLoaded(qtyNode);
    const qty = Number.isFinite(product.qty) ? Math.max(0, Math.floor(product.qty as number)) : chooseB2BQty();
    qtyNode.characters = String(qty);
  }

  const priceNode = findChildByName(card, "product-price");
  if (priceNode?.type === "TEXT") { await ensureFontLoaded(priceNode); priceNode.characters = `${sign}${product.price.toFixed(2)}`; }

  const ratingNode = findChildByName(card, "product-rating");
  if (ratingNode?.type === "TEXT") { await ensureFontLoaded(ratingNode); ratingNode.characters = product.rating.toFixed(1); }

  const reviewsNode = findChildByNames(card, REVIEW_LAYER_NAMES);
  if (reviewsNode?.type === "TEXT") {
    await ensureFontLoaded(reviewsNode);
    const withParens = reviewsNode.characters.trim().startsWith("(");
    reviewsNode.characters = withParens ? `(${product.reviewCount})` : String(product.reviewCount);
  }

  const descNode = findChildByName(card, "product-description");
  if (descNode?.type === "TEXT" && product.description) { await ensureFontLoaded(descNode); descNode.characters = product.description; }

  const brandNode = findChildByName(card, "product-brand");
  if (brandNode?.type === "TEXT" && product.brand) { await ensureFontLoaded(brandNode); brandNode.characters = product.brand; }

  const strikeNode = findChildByNames(card, STRIKETHROUGH_PRICE_NAMES);
  if (strikeNode?.type === "TEXT" && product.originalPrice != null) {
    await ensureFontLoaded(strikeNode);
    strikeNode.characters = `${sign}${product.originalPrice.toFixed(2)}`;
  }

  const discountNode = findChildByNames(card, DISCOUNT_LAYER_NAMES);
  if (discountNode?.type === "TEXT" && product.discountPercentage != null) {
    await ensureFontLoaded(discountNode);
    discountNode.characters = `${Math.round(product.discountPercentage)}%`;
  }
}

function applyImageToCard(card: CardCandidate, image: Image): boolean {
  const imageNode = findChildByName(card, "product-image") ?? findChildByName(card, "Image Container");
  if (!imageNode) return false;

  const area = (n: BaseNode & GeometryMixin) => {
    const w = "width" in n ? (n as { width: number }).width : 0;
    const h = "height" in n ? (n as { height: number }).height : 0;
    return w * h;
  };

  let fillTarget: (BaseNode & GeometryMixin) | null = null;
  if ("findAll" in imageNode) {
    const withFills = (imageNode as BaseNode & ChildrenMixin).findAll((n) => "fills" in n) as (BaseNode & GeometryMixin)[];
    if (withFills.length > 0) fillTarget = withFills.reduce((best, n) => (area(n) > area(best) ? n : best));
  }
  if (!fillTarget && "fills" in imageNode) fillTarget = imageNode as BaseNode & GeometryMixin;
  if (!fillTarget) return false;

  try {
    const existingFills = fillTarget.fills;
    if (Array.isArray(existingFills)) {
      const idx = (existingFills as Paint[]).findIndex((f: Paint) => f.type === "IMAGE");
      if (idx >= 0) {
        const cloned = (existingFills as Paint[]).map((f: Paint) => ({ ...f }));
        (cloned[idx] as Record<string, unknown>).imageHash = image.hash;
        fillTarget.fills = cloned;
        return true;
      }
    }
    fillTarget.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" } as ImagePaint];
    return true;
  } catch {
    return false;
  }
}

function sendToUI(payload: { type: string; message?: string; count?: number; imageSetCount?: number }) {
  figma.ui.postMessage(payload);
}

figma.showUI(__html__, { width: 400, height: 540 });

figma.ui.onmessage = async (msg: {
  type: string;
  currency?: CurrencyCode;
  localProducts?: Product[];
}) => {
  if (msg.type !== "populate") return;

  const currency: CurrencyCode = msg.currency ?? "DHM";
  const products: Product[] = msg.localProducts ?? [];

  if (products.length === 0) {
    sendToUI({ type: "error", message: "No products selected. Check the catalog data." });
    return;
  }

  const cards = findProductCards();
  if (cards.length === 0) {
    sendToUI({
      type: "error",
      message: 'No product cards found. Select frames with layers named product-image and product-title (case-sensitive). See "How to use" below.',
    });
    return;
  }

  const shuffled = shuffle(products.slice());
  const assignments: Array<{ card: CardCandidate; product: Product }> = [];
  for (let i = 0; i < cards.length; i++) {
    assignments.push({ card: cards[i], product: shuffled[i % shuffled.length] });
  }

  for (const { card, product } of assignments) {
    await applyTextToCard(card, product, currency);
  }
  figma.viewport.scrollAndZoomIntoView(cards);
  sendToUI({ type: "progress", message: `Text done for ${cards.length} card${cards.length > 1 ? "s" : ""}. Loading images…` });

  const imageCache = new Map<string, Image>();
  let imageSetCount = 0;
  const MAX_CONCURRENT = 4;

  async function processImage(assignment: typeof assignments[0]): Promise<void> {
    const { card, product } = assignment;
    if (!product.thumbnail) return;
    const img = await loadImageFromUrl(product.thumbnail, imageCache);
    if (img && applyImageToCard(card, img)) { imageSetCount++; }
  }

  const running: Promise<void>[] = [];
  for (const item of assignments) {
    const p = processImage(item);
    running.push(p);
    if (running.length >= MAX_CONCURRENT) {
      await Promise.race(running);
      for (let i = running.length - 1; i >= 0; i--) {
        const settled = await Promise.race([running[i].then(() => true), Promise.resolve(false)]);
        if (settled) running.splice(i, 1);
      }
    }
  }
  await Promise.all(running);

  sendToUI({ type: "done", count: cards.length, imageSetCount });
  figma.viewport.scrollAndZoomIntoView(cards);
};
