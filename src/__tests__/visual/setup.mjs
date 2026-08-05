// Visual-test setup: everything that would otherwise make a screenshot differ
// between two runs of identical code.
import '@/app/layout.css';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { FIXED_NOW } from './fixtures.mjs';

// Animations and transitions are the main source of screenshot flake — a
// capture can land mid-transition. Killing them globally is cheaper and more
// reliable than waiting for each one to settle.
const style = document.createElement('style');
style.textContent = `*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
}`;
document.head.appendChild(style);

beforeEach(() => {
    // Only Date is faked; setTimeout/rAF stay real so React renders normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});
