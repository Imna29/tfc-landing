/**
 * The code that takes money off TFC's pay-per-view stream, and the site that
 * sells it. The hero hangs it on its stream button as a sticker, so a fan
 * learns about the discount on the way to the checkout rather than after it.
 *
 * Written here rather than in Prismic: the code changes rarely, and only with a
 * deploy. The hero's buttons are still Prismic's, though, so the code is bound
 * to where a button goes rather than to which button it is. Point the stream
 * button somewhere else and the sticker goes with it — a code shown beside a
 * checkout that refuses it is worse than no code at all.
 *
 * 1vs1.tv is a WooCommerce shop, which matches coupon codes without regard to
 * case, so the code is written the way the hero writes everything else.
 */
export const STREAM_PROMO = { host: "1vs1.tv", code: "TFC" } as const;

/** The code to show on a link to `url`, or `null` if it would not work there. */
export function streamPromoCode(url: string | null | undefined): string | null {
  if (!url || !URL.canParse(url)) {
    return null;
  }

  const { hostname } = new URL(url);
  const onStreamSite = hostname === STREAM_PROMO.host || hostname.endsWith(`.${STREAM_PROMO.host}`);

  return onStreamSite ? STREAM_PROMO.code : null;
}
