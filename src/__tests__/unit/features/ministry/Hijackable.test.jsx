// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import Hijackable from '@/features/ministry/Hijackable';

describe('Hijackable — idle render (no provider)', () => {
    test('renders as a plain <span> by default with text content', () => {
        const { container } = render(<Hijackable text="Hello" />);
        const span = container.firstChild;
        expect(span.tagName).toBe('SPAN');
        expect(span.textContent).toBe('Hello');
        expect(span.getAttribute('aria-label')).toBeNull();
        expect(span.querySelector('.glitch-char')).toBeNull();
    });

    test('as="h1" renders as an <h1>', () => {
        const { container } = render(
            <Hijackable as="h1" category="heading" text="My Title" />,
        );
        expect(container.firstChild.tagName).toBe('H1');
        expect(container.firstChild.textContent).toBe('My Title');
    });

    test('className is applied to the wrapper element', () => {
        const { container } = render(
            <Hijackable as="h2" category="heading" text="X" className="font-display" />,
        );
        expect(container.firstChild.className).toContain('font-display');
    });

    test('banned categories (nav/button/link) throw a dev assertion', () => {
        // In dev (process.env.NODE_ENV !== 'production'), this should throw.
        // We invoke the component and assert React surfaces an error.
        expect(() => render(<Hijackable as="span" category="nav" text="X" />)).toThrow();
        expect(() =>
            render(<Hijackable as="span" category="button" text="X" />),
        ).toThrow();
    });
});
