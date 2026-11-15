import { cleanup } from "@testing-library/react";
import { installFakeMatchMedia } from "../helpers/fakeMatchMedia";

/** jsdom has no layout engine; Radix expects these browser APIs to exist. */
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  installFakeMatchMedia(false);
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});
