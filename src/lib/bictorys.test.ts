import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCharge, getTransactionStatus, type CreateChargeInput } from "@/lib/bictorys";

const fetchMock = vi.fn();

const INPUT: CreateChargeInput = {
  amount: 4_000,
  currency: "XOF",
  reference: "cortex_abc",
  merchantReference: "user_a",
  label: "Cortex Pro — 1 month",
  successUrl: "https://app.test/settings/billing?ref=cortex_abc",
  errorUrl: "https://app.test/settings/billing?ref=cortex_abc&error=1",
  customer: { name: "Ada", email: "ada@example.com" },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("BICTORYS_API_URL", "https://api.bictorys.test/");
  vi.stubEnv("BICTORYS_API_KEY", "public_key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("createCharge", () => {
  it("posts the charge with the API key", async () => {
    fetchMock.mockResolvedValue(json(202, { link: "https://pay.test/x", chargeId: "ch_1" }));

    await createCharge(INPUT);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.bictorys.test/pay/v1/charges");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Api-Key"]).toBe("public_key");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toEqual({
      amount: 4_000,
      currency: "XOF",
      paymentReference: "cortex_abc",
      merchantReference: "user_a",
      successRedirectUrl: INPUT.successUrl,
      errorRedirectUrl: INPUT.errorUrl,
      customerObject: { name: "Ada", email: "ada@example.com" },
      orderDetails: [{ name: "Cortex Pro — 1 month", price: 4_000, quantity: 1 }],
    });
  });

  it("reads the hosted-checkout 202 shape", async () => {
    fetchMock.mockResolvedValue(json(202, { type: "CheckoutLinkObject", link: "https://pay.test/x", chargeId: "ch_1" }));

    expect(await createCharge(INPUT)).toEqual({ redirectUrl: "https://pay.test/x", transactionId: "ch_1" });
  });

  it("prefers the documented 201 shape", async () => {
    fetchMock.mockResolvedValue(
      json(201, { redirectUrl: "https://pay.test/r", transactionId: "tx_1", link: "https://pay.test/x", chargeId: "ch_1" }),
    );

    expect(await createCharge(INPUT)).toEqual({ redirectUrl: "https://pay.test/r", transactionId: "tx_1" });
  });

  it("returns a null transaction id when none is given", async () => {
    fetchMock.mockResolvedValue(json(202, { link: "https://pay.test/x" }));

    expect((await createCharge(INPUT)).transactionId).toBeNull();
  });

  it("throws without a redirect URL", async () => {
    fetchMock.mockResolvedValue(json(202, { chargeId: "ch_1" }));

    await expect(createCharge(INPUT)).rejects.toThrow("no redirect URL");
  });

  it("throws on a non-2xx with the status and a bounded body", async () => {
    fetchMock.mockResolvedValue(new Response(`<html>${"x".repeat(1_000)}</html>`, { status: 403 }));

    const error = await createCharge(INPUT).catch((e: Error) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^Bictorys charge failed: 403 <html>x+$/);
    expect((error as Error).message.length).toBeLessThanOrEqual("Bictorys charge failed: 403 ".length + 300);
  });

  it.each(["BICTORYS_API_URL", "BICTORYS_API_KEY"])("throws when %s is missing", async (name) => {
    vi.stubEnv(name, "");

    await expect(createCharge(INPUT)).rejects.toThrow("are not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getTransactionStatus", () => {
  it("returns the status", async () => {
    fetchMock.mockResolvedValue(json(200, { status: "succeeded" }));

    expect(await getTransactionStatus("tx/1")).toBe("succeeded");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.bictorys.test/pay/v1/transactions/tx%2F1/status");
    expect(init.headers["X-Api-Key"]).toBe("public_key");
  });

  it("returns null on a non-2xx", async () => {
    fetchMock.mockResolvedValue(json(404, { message: "not found" }));

    expect(await getTransactionStatus("tx_1")).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));

    expect(await getTransactionStatus("tx_1")).toBeNull();
  });

  it("returns null when the env is missing", async () => {
    vi.stubEnv("BICTORYS_API_KEY", "");

    expect(await getTransactionStatus("tx_1")).toBeNull();
  });
});
