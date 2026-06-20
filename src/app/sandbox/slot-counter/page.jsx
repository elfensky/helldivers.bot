'use client';

import { useEffect, useRef, useState } from 'react';
import AnimatedStat from '@/shared/components/AnimatedStat/AnimatedStat';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

const localeFormat = (n) => {
    if (n === null || n === undefined) return '—';
    const num = Number(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString();
};

export default function SlotCounterSandboxPage() {
    const [value, setValue] = useState(1_234_567);
    const [duration, setDuration] = useState(0.06);
    const [durationEnabled, setDurationEnabled] = useState(true);
    const [sequential, setSequential] = useState(false);
    const [monospace, setMonospace] = useState(true);
    const [autoTick, setAutoTick] = useState(false);
    const autoRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));
    const durationProp = durationEnabled ? duration : undefined;

    useEffect(() => {
        if (!autoTick) return;
        autoRef.current = setInterval(() => {
            setValue((v) => v + Math.floor(Math.random() * 10000) + 1);
        }, 2000);
        return () => clearInterval(autoRef.current ?? undefined);
    }, [autoTick]);

    const bump = (delta) => setValue((v) => v + delta);
    const randomize = () => setValue(Math.floor(Math.random() * 9_999_999_999) + 1);

    return (
        <main className="min-h-screen bg-surface-0 p-6 text-text md:p-12">
            <div className="mx-auto flex max-w-4xl flex-col gap-12">
                <header className="flex flex-col gap-2">
                    <h1 className="font-display text-3xl font-black tracking-wider text-primary uppercase">
                        AnimatedStat Sandbox
                    </h1>
                    <p className="text-sm text-text-muted">
                        Wraps{' '}
                        <code className="font-mono text-xs">react-slot-counter</code>.
                        Only changed digits animate. First render is static. Direction
                        flips with the sign of the delta.
                    </p>
                </header>

                <section className="flex flex-col gap-4">
                    <span className="font-mono text-xs tracking-wide text-text-muted uppercase">
                        Raw value: {value.toLocaleString()}
                    </span>

                    <div className="flex flex-wrap gap-2">
                        <Btn onClick={() => bump(-1_000_000)}>−1,000,000</Btn>
                        <Btn onClick={() => bump(-1000)}>−1,000</Btn>
                        <Btn onClick={() => bump(-10)}>−10</Btn>
                        <Btn onClick={() => bump(-1)}>−1</Btn>
                        <Btn onClick={() => bump(1)}>+1</Btn>
                        <Btn onClick={() => bump(10)}>+10</Btn>
                        <Btn onClick={() => bump(1000)}>+1,000</Btn>
                        <Btn onClick={() => bump(1_000_000)}>+1,000,000</Btn>
                        <Btn onClick={randomize}>random</Btn>
                        <Btn onClick={() => setValue(1_234_567)}>reset value</Btn>
                        <Btn onClick={() => setAutoTick((t) => !t)} active={autoTick}>
                            {autoTick ? 'stop auto-tick' : 'auto-tick 2s'}
                        </Btn>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Btn onClick={() => setValue(99)}>set 99</Btn>
                        <Btn onClick={() => setValue(100)}>set 100</Btn>
                        <Btn onClick={() => setValue(999)}>set 999</Btn>
                        <Btn onClick={() => setValue(1000)}>set 1,000</Btn>
                        <Btn onClick={() => setValue(9999)}>set 9,999</Btn>
                        <Btn onClick={() => setValue(10_000)}>set 10,000</Btn>
                        <span className="self-center font-mono text-xs tracking-wide text-text-muted uppercase">
                            (preset values for testing leading-digit growth)
                        </span>
                    </div>
                </section>

                <section className="flex flex-col gap-3 border-l-2 border-primary pl-4">
                    <span className="font-mono text-xs tracking-wide text-primary uppercase">
                        knobs
                    </span>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 font-mono text-xs tracking-wide text-text uppercase">
                            <input
                                type="checkbox"
                                checked={durationEnabled}
                                onChange={(e) => setDurationEnabled(e.target.checked)}
                                className="accent-primary"
                            />
                            duration
                        </label>
                        {durationEnabled ?
                            <Slider
                                label=""
                                value={duration}
                                min={0.01}
                                max={2}
                                step={0.01}
                                unit="s"
                                onChange={setDuration}
                            />
                        :   <span className="font-mono text-xs text-text-muted">
                                prop omitted — library default (0.7s) applies
                            </span>
                        }
                    </div>
                    <div className="flex flex-wrap items-center gap-6">
                        <Toggle
                            label="sequentialAnimationMode"
                            value={sequential}
                            onChange={setSequential}
                            hint="digits roll through 0-9 from old to new (odometer feel)"
                        />
                        <Toggle
                            label="useMonospaceWidth"
                            value={monospace}
                            onChange={setMonospace}
                            hint="all slots sized to the widest digit — no width shimmy"
                        />
                    </div>
                </section>

                <Row label="Homepage stat style (compact, font-display)">
                    <span
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 'var(--text-h2)',
                            fontWeight: 900,
                            color: 'var(--color-primary)',
                            lineHeight: 1,
                        }}
                    >
                        <AnimatedStat
                            value={value}
                            format={formatNumber}
                            duration={durationProp}
                            sequentialAnimationMode={sequential}
                            useMonospaceWidth={monospace}
                        />
                    </span>
                </Row>

                <Row label="Comma-grouped locale format">
                    <span
                        style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: 'var(--text-h3)',
                            color: 'var(--color-text)',
                            lineHeight: 1,
                        }}
                    >
                        <AnimatedStat
                            value={value}
                            format={localeFormat}
                            duration={durationProp}
                            sequentialAnimationMode={sequential}
                            useMonospaceWidth={monospace}
                        />
                    </span>
                </Row>

                <Row label="Proportional body font (where monospace toggle matters most)">
                    <span
                        style={{
                            fontFamily: 'var(--font-body, sans-serif)',
                            fontSize: 'var(--text-h3)',
                            color: 'var(--color-text)',
                            lineHeight: 1,
                        }}
                    >
                        <AnimatedStat
                            value={value}
                            format={(n) => String(n)}
                            duration={durationProp}
                            sequentialAnimationMode={sequential}
                            useMonospaceWidth={monospace}
                        />
                    </span>
                </Row>

                <Row label="A/B comparison — always monospace vs always proportional">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-baseline gap-3">
                            <span className="w-36 shrink-0 font-mono text-xs tracking-wide text-text-muted uppercase">
                                monospace on
                            </span>
                            <span
                                style={{
                                    fontFamily: 'var(--font-body, sans-serif)',
                                    fontSize: 'var(--text-h3)',
                                    color: 'var(--color-text)',
                                    lineHeight: 1,
                                }}
                            >
                                <AnimatedStat
                                    value={value}
                                    format={(n) => String(n)}
                                    duration={durationProp}
                                    sequentialAnimationMode={sequential}
                                    useMonospaceWidth
                                />
                            </span>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="w-36 shrink-0 font-mono text-xs tracking-wide text-text-muted uppercase">
                                monospace off
                            </span>
                            <span
                                style={{
                                    fontFamily: 'var(--font-body, sans-serif)',
                                    fontSize: 'var(--text-h3)',
                                    color: 'var(--color-text)',
                                    lineHeight: 1,
                                }}
                            >
                                <AnimatedStat
                                    value={value}
                                    format={(n) => String(n)}
                                    duration={durationProp}
                                    sequentialAnimationMode={sequential}
                                    useMonospaceWidth={false}
                                />
                            </span>
                        </div>
                    </div>
                </Row>
            </div>
        </main>
    );
}

function Row({ label, children }) {
    return (
        <section className="flex flex-col gap-2 border-l-2 border-ghost pl-4">
            <span className="font-mono text-xs tracking-wide text-text-muted uppercase">
                {label}
            </span>
            <div>{children}</div>
        </section>
    );
}

function Btn({ onClick, active = false, children }) {
    const base =
        'font-mono text-xs uppercase tracking-wide px-3 py-1.5 border transition-colors';
    const variant =
        active ?
            'border-primary text-primary bg-surface-1'
        :   'border-ghost text-text hover:border-primary hover:text-primary';
    return (
        <button onClick={onClick} className={`${base} ${variant}`}>
            {children}
        </button>
    );
}

function Slider({ label, value, min, max, step, unit, onChange }) {
    return (
        <label className="flex items-center gap-3">
            <span className="w-20 shrink-0 font-mono text-xs tracking-wide text-text-muted uppercase">
                {label}
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1"
            />
            <span className="w-16 text-right font-mono text-xs text-text tabular-nums">
                {value.toFixed(2)}
                {unit}
            </span>
        </label>
    );
}

function Toggle({ label, value, onChange, hint }) {
    return (
        <label className="flex cursor-pointer flex-col gap-0.5">
            <span className="flex items-center gap-2 font-mono text-xs tracking-wide text-text uppercase">
                <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="accent-primary"
                />
                {label}
            </span>
            {hint && (
                <span className="pl-6 font-mono text-xs text-text-muted normal-case">
                    {hint}
                </span>
            )}
        </label>
    );
}
