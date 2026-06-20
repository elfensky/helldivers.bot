'use client';
import { useEffect, useId, useRef, useState, useCallback } from 'react';
import './MinistryInterference.css';
import GlitchText from '@/features/archives/GlitchText';
import { useMinistryContext } from '@/features/ministry/MinistryContext.mjs';
import {
    useMinistryHijackCycle,
    TAKEOVER_MS,
    RESTORE_MS,
} from '@/features/ministry/useMinistryHijackCycle.mjs';

const VALID_CATEGORIES = new Set(['heading', 'value', 'body', 'footer']);

/**
 * Opt-in wrapper for sitewide Ministry Interference.
 *
 * Idle: a plain semantic element with the truth as its only child.
 *
 * Hijack: the wrapper element contains two children:
 *  1. An `sr-only` <span> with the truth — screen readers always
 *     announce this, even mid-hijack.
 *  2. An `aria-hidden="true"` overlay rendering GlitchText with the
 *     propaganda string. Visually visible to sighted users; invisible
 *     to assistive tech.
 *
 * The sr-only + aria-hidden pattern is explicitly NOT cloaking: the
 * propaganda only exists in the DOM for ~2.6s during a rare hijack
 * (not persistently), and it's marked aria-hidden the whole time.
 *
 * @param {object} props - component props
 * @param {string} props.text - the truth (required)
 * @param {string=} props.altText - explicit propaganda override
 * @param {'heading' | 'value' | 'body' | 'footer'} [props.category='body'] - content category
 * @param {'global' | 'archives'} [props.scope='global'] - scope for interference rules
 * @param {string=} props.className - class name for wrapper element
 * @param {string=} props.altClassName - class name for propaganda overlay
 * @param {string} [props.as='span'] - wrapper tag
 */
export default function Hijackable({
    text,
    altText,
    category = 'body',
    scope = 'global',
    className,
    altClassName,
    as = 'span',
    ...rest
}) {
    if (process.env.NODE_ENV !== 'production' && !VALID_CATEGORIES.has(category)) {
        throw new Error(
            `<Hijackable>: category "${category}" is not allowed. Use one of: heading, value, body, footer.`,
        );
    }

    const ctx = useMinistryContext();
    const id = useId();
    const { phase, trigger } = useMinistryHijackCycle();
    const [activeAlt, setActiveAlt] = useState(null);
    const [flickerState, setFlickerState] = useState(null); // { charIndex, glyph }

    const onHijack = useCallback(
        (alt) => {
            setActiveAlt(alt);
            trigger();
        },
        [trigger],
    );

    const flickerTimerRef = useRef(null);
    const onFlicker = useCallback((charIndex, durationMs) => {
        clearTimeout(flickerTimerRef.current);
        // Capture the glyph at flicker-start so it stays stable for the
        // duration even if React re-renders the component for unrelated reasons.
        setFlickerState({ charIndex, glyph: randomGlyph() });
        flickerTimerRef.current = setTimeout(() => setFlickerState(null), durationMs);
    }, []);

    // Reset overlay when the cycle returns to idle.
    useEffect(() => {
        if (phase === 'idle') setActiveAlt(null);
    }, [phase]);

    // Mirror local idle state back to the registry so the ambient
    // flicker scheduler can skip mid-hijack elements.
    useEffect(() => {
        if (!ctx) return;
        ctx.setIdle(id, phase === 'idle');
    }, [ctx, id, phase]);

    // Register on mount, unregister on unmount.
    useEffect(() => {
        if (!ctx) return;
        ctx.register(id, {
            text,
            altText,
            category,
            scope,
            onHijack,
            onFlicker,
        });
        return () => {
            ctx.unregister(id);
            clearTimeout(flickerTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional run-once registration: id (useId) is stable per mount; the other deps (text/altText/category/scope/onHijack/onFlicker/ctx) are deliberately omitted so the descriptor registers on mount and unregisters on unmount only. Listing them would re-register on every warTone flip (ctx re-creates) and on every content change — unwanted registry churn. React Compiler skips this component as a result.
    }, [id]);

    const Tag = as;
    const isHijacking = phase !== 'idle' && activeAlt;

    // Idle path: just the truth.
    if (!isHijacking && !flickerState) {
        return (
            <Tag className={className} {...rest}>
                {text}
            </Tag>
        );
    }

    // Hijack path: sr-only truth + aria-hidden propaganda overlay.
    if (isHijacking) {
        return (
            <Tag className={className} {...rest}>
                <span className="sr-only">{text}</span>
                <span aria-hidden="true" className="ministry-overlay">
                    <GlitchText
                        text={text}
                        altText={activeAlt}
                        className={className}
                        altClassName={altClassName}
                        phase={phase}
                        takeoverMs={TAKEOVER_MS}
                        restoreMs={RESTORE_MS}
                    />
                </span>
            </Tag>
        );
    }

    // Flicker path: render the truth with one char visually replaced
    // by a glitch glyph; assistive tech still announces the truth.
    if (flickerState) {
        const { charIndex, glyph } = flickerState;
        return (
            <Tag className={className} {...rest}>
                <span className="sr-only">{text}</span>
                <span aria-hidden="true">
                    {text.slice(0, charIndex)}
                    <span className="glitch-char">{glyph}</span>
                    {text.slice(charIndex + 1)}
                </span>
            </Tag>
        );
    }

    return null;
}

const GLYPH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randomGlyph() {
    return GLYPH_CHARS[Math.floor(Math.random() * GLYPH_CHARS.length)];
}
