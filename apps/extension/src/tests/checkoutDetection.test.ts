import { describe, expect, it } from "vitest";

import {
  detectCheckoutContext,
  detectPurchaseAmountCents,
} from "../checkoutDetection.js";

function makeDocument(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

describe("checkout detection", () => {
  it("treats checkout URLs as checkout-like", () => {
    const result = detectCheckoutContext(makeDocument("<main></main>"), {
      href: "https://example.com/checkout",
      pathname: "/checkout",
    } as Location);

    expect(result.isCheckoutLike).toBe(true);
    expect(["HIGH", "MEDIUM"]).toContain(result.confidence);
  });

  it("uses DOM text and form signals", () => {
    const result = detectCheckoutContext(
      makeDocument(`
        <main>
          <h1>Order summary</h1>
          <p>Payment and billing</p>
          <button>Place order</button>
        </main>
      `),
      { href: "https://example.com/review", pathname: "/review" } as Location,
    );

    expect(result.isCheckoutLike).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("does not show on product pages or login pages", () => {
    const product = detectCheckoutContext(
      makeDocument("<h1>Product details</h1><button>Add to cart</button>"),
      {
        href: "https://example.com/products/shirt",
        pathname: "/products/shirt",
      } as Location,
    );
    const login = detectCheckoutContext(makeDocument("<h1>Sign in</h1>"), {
      href: "https://example.com/login",
      pathname: "/login",
    } as Location);

    expect(product.isCheckoutLike).toBe(false);
    expect(login.isCheckoutLike).toBe(false);
  });

  it("parses confident order totals and ignores ambiguous totals", () => {
    expect(
      detectPurchaseAmountCents(
        makeDocument("<p>Order total $123.45</p><p>Shipping $5.00</p>"),
      ),
    ).toBe(12345);
    expect(
      detectPurchaseAmountCents(
        makeDocument("<p>Total $20.00</p><p>Order total $123.45</p>"),
      ),
    ).toBeNull();
  });
});
