'use client';

import { useState, useEffect, useRef } from 'react';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TICK_MS = 50;
const PULSE_MIN_MS = 6000;
const PULSE_MAX_MS = 12000;
const PULSE_DURATION_MS = 300;

function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

function randomPulseDelay() {
    return PULSE_MIN_MS + Math.random() * (PULSE_MAX_MS - PULSE_MIN_MS);
}

/**
 * GlitchText — persistent text-scramble effect with two independent glitch layers.
 *
 * - Effect A (copy swap): chars briefly show altText characters (with altClassName color)
 * - Effect B (Cyberstan scramble): chars show random glyphs in font-cyberstan (red)
 * - Effects can combine per-character per-pulse
 *
 * Props:
 *   text         — base text displayed in idle state
 *   altText      — alternate text for Effect A (optional)
 *   className    — styling for base text
 *   altClassName — styling for Effect A chars (optional, defaults to className)
 *   active       — enables animation (false = static base text)
 */
export default function GlitchText({
    text,
    altText,
    className,
    altClassName,
    active = true,
}) {
    // SSR-safe: initialize with base text (deterministic)
    const [display, setDisplay] = useState(text);
    const [charStyles, setCharStyles] = useState(null); // null = all default
    const timerRef = useRef(null);
    const tickRef = useRef(null);

    useEffect(() => {
        if (!active) {
            setDisplay(text);
            setCharStyles(null);
            return;
        }

        const reducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reducedMotion) {
            setDisplay(text);
            setCharStyles(null);
            return;
        }

        function schedulePulse() {
            timerRef.current = setTimeout(pulse, randomPulseDelay());
        }

        function pulse() {
            // For each character, independently decide: no effect, A, B, or A+B
            const maxLen = Math.max(text.length, altText?.length ?? 0);
            const styles = [];
            const chars = [];

            for (let i = 0; i < text.length; i++) {
                const roll = Math.random();
                const hasAlt = altText && i < altText.length;

                if (roll < 0.15 && hasAlt) {
                    // Effect A only: show altText char with altClassName
                    chars.push(altText[i]);
                    styles.push('alt');
                } else if (roll < 0.30) {
                    // Effect B only: random char in Cyberstan font
                    chars.push(randomChar());
                    styles.push('cyberstan');
                } else if (roll < 0.38 && hasAlt) {
                    // Both A+B: altText char in Cyberstan font
                    chars.push(altText[i]);
                    styles.push('both');
                } else {
                    // No effect: keep base char
                    chars.push(text[i]);
                    styles.push(null);
                }
            }

            setDisplay(chars.join(''));
            setCharStyles(styles);

            // Hold the glitch briefly, then settle back
            tickRef.current = setTimeout(() => {
                setDisplay(text);
                setCharStyles(null);
                schedulePulse();
            }, PULSE_DURATION_MS);
        }

        schedulePulse();

        return () => {
            clearTimeout(timerRef.current);
            clearTimeout(tickRef.current);
        };
    }, [text, altText, active]);

    // No per-char styling needed — render as plain text
    if (!charStyles) {
        return <span className={className}>{display}</span>;
    }

    // Render with per-character styling
    return (
        <span className={className}>
            {display.split('').map((char, i) => {
                const style = charStyles[i];
                if (!style) return char;
                if (style === 'alt')
                    return (
                        <span key={i} className={altClassName || className}>
                            {char}
                        </span>
                    );
                if (style === 'cyberstan')
                    return (
                        <span key={i} className="glitch-char">
                            {char}
                        </span>
                    );
                // 'both' — altText char in Cyberstan font
                return (
                    <span key={i} className="glitch-char">
                        {char}
                    </span>
                );
            })}
        </span>
    );
}
