/**
 * Stand-in for `next/link`, aliased in vitest.visual.config.mjs — the real one
 * needs Next's router context, which no browser-mode test has.
 *
 * @param {object} props
 * @param {string} props.href
 * @param {import('react').ReactNode} props.children
 */
export default function Link({ href, children, ...rest }) {
    const { prefetch, replace, scroll, shallow, ...domProps } = rest;
    return (
        <a href={href} {...domProps}>
            {children}
        </a>
    );
}
