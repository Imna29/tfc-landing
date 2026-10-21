// PROTOTYPE — throwaway. Shared bits for the hero stream-CTA variants
// (`?variant=A|B|C|D` on `/`). Delete with the rest of this folder once a
// variant wins.
import type { Content } from "@prismicio/client";

export type HeroCta = Content.HeroSectionSliceDefaultPrimaryCtaItem;

// 1vs1.tv is WooCommerce, which matches coupon codes case-insensitively, so
// the hero's all-caps voice is safe here.
export const PROMO_CODE = "TFC";

export function useCopyPromo() {
  const copied = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function copy() {
    await navigator.clipboard.writeText(PROMO_CODE);
    copied.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => (copied.value = false), 1600);
  }

  return { copied, copy };
}

export function streamHost(cta: HeroCta | undefined) {
  const link = cta?.link;
  if (!link || !("url" in link) || !link.url) return "";
  return new URL(link.url).hostname.replace(/^www\./, "");
}
