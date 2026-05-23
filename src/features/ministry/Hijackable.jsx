'use client';
import './MinistryInterference.css';

const VALID_CATEGORIES = new Set(['heading', 'value', 'body', 'footer']);

/**
 * Opt-in wrapper for sitewide Ministry Interference.
 *
 * In idle (the common case) renders as a plain semantic element with
 * the truth text as its only text content — no listeners, no extra
 * DOM, no glitch classes. The hijack/flicker rendering paths are
 * added in later tasks.
 *
 * @param {object} props - component props
 * @param {string} props.text - the truth (required)
 * @param {string=} props._altText - explicit propaganda override
 * @param {'heading' | 'value' | 'body' | 'footer'} [props.category='body'] - content category for context
 * @param {'global' | 'archives'} [props._scope='global'] - scope for interference rules
 * @param {string=} props.className - class name for wrapper element
 * @param {string=} props._altClassName - class name for propaganda overlay (future)
 * @param {string} [props.as='span'] - wrapper tag
 */
export default function Hijackable({
    text,
    _altText,
    category = 'body',
    _scope = 'global',
    className,
    _altClassName,
    as = 'span',
    ...rest
}) {
    if (process.env.NODE_ENV !== 'production' && !VALID_CATEGORIES.has(category)) {
        throw new Error(
            `<Hijackable>: category "${category}" is not allowed. Use one of: heading, value, body, footer. (nav/button/link banned by accessibility constraint.)`,
        );
    }
    const Tag = as;
    return (
        <Tag className={className} {...rest}>
            {text}
        </Tag>
    );
}
