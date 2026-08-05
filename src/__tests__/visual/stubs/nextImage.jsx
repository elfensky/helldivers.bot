/**
 * Stand-in for `next/image`, aliased in vitest.visual.config.mjs.
 *
 * The real component rewrites `src` into a `/_next/image?url=…` request that
 * only a running Next server answers, so every icon would render broken in a
 * screenshot. A plain `<img>` loads the same file straight out of `public/`,
 * which Vite serves at the web root.
 *
 * @param {object} props
 * @param {string} props.src
 * @param {string} [props.alt]
 * @param {number} [props.width]
 * @param {number} [props.height]
 */
export default function Image({ src, alt = '', width, height, ...rest }) {
    // Next-only props would hit the DOM as unknown attributes and log warnings.
    const { priority, fill, quality, unoptimized, loader, placeholder, ...domProps } =
        rest;
    return <img src={src} alt={alt} width={width} height={height} {...domProps} />;
}
