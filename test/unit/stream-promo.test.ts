import { describe, expect, it } from "vitest";
import { streamPromoCode } from "../../app/utils/streamPromo";

/**
 * The hero tells a fan which code takes money off the stream. A code is only
 * worth showing on a link to the checkout that accepts it — see
 * `app/utils/streamPromo.ts`.
 */
describe("streamPromoCode", () => {
  it("is offered on a link to the stream's checkout", () => {
    expect(streamPromoCode("https://1vs1.tv/cart/")).toBe("TFC");
  });

  it("is offered whatever page of the stream's site the link lands on", () => {
    expect(streamPromoCode("https://www.1vs1.tv/event/tfc-14")).toBe("TFC");
  });

  it("is not offered on a link to anywhere else", () => {
    expect(streamPromoCode("https://www.youtube.com/@tfc")).toBeNull();
  });

  it("is not fooled by a host that only contains the stream's name", () => {
    expect(streamPromoCode("https://not1vs1.tv/cart/")).toBeNull();
    expect(streamPromoCode("https://1vs1.tv.example.com/cart/")).toBeNull();
  });

  it("has nothing to say about a page on this site or an empty link", () => {
    expect(streamPromoCode("/events")).toBeNull();
    expect(streamPromoCode(null)).toBeNull();
  });
});
