import { installFakeShopos } from "../../../../tests/helpers/fakeShopos";
import { ApiError, call, messageOf } from "./api";

describe("call", () => {
  it("returns the data of a command that succeeded", async () => {
    installFakeShopos({ "settings.get": () => ({ name: "Prabhat Hardware" }) as never });

    const profile = await call("settings.get", {});

    expect(profile).toEqual({ name: "Prabhat Hardware" });
  });

  it("throws an ApiError with the contract's code, message and details when a command fails", async () => {
    installFakeShopos({
      "items.create": () => {
        throw Object.assign(new Error("An item with this name exists"), {
          code: "DUPLICATE_NAME",
          details: [{ id: "item-1" }],
        });
      },
    });

    const failure = await call("items.create", {} as never).catch((caughtError) => caughtError);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.code).toBe("DUPLICATE_NAME");
    expect(failure.message).toBe("An item with this name exists");
    expect(failure.details).toEqual([{ id: "item-1" }]);
  });

  it("falls back to INTERNAL and a plain message when the reply carries neither", async () => {
    window.shopos = {
      "stock.adjust": async () => ({ ok: false }),
    } as unknown as typeof window.shopos;

    const failure = await call("stock.adjust", {} as never).catch((caughtError) => caughtError);

    expect(failure.code).toBe("INTERNAL");
    expect(failure.message).toBe("Something went wrong");
  });
});

describe("messageOf", () => {
  it("gives the message of an Error and the text of anything else", () => {
    expect(messageOf(new Error("Disk is full"))).toBe("Disk is full");
    expect(messageOf("plain text")).toBe("plain text");
  });
});
