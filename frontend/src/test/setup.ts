import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// jsdom lacks matchMedia (shadcn sidebar's use-mobile hook reads it).
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// Radix (AlertDialog/Select) calls these; jsdom doesn't implement them.
const proto = Element.prototype as any;
if (!proto.scrollIntoView) proto.scrollIntoView = vi.fn();
if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
if (!proto.setPointerCapture) proto.setPointerCapture = vi.fn();
if (!proto.releasePointerCapture) proto.releasePointerCapture = vi.fn();
