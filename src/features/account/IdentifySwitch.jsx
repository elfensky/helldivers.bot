'use client';

import { useState } from 'react';
import Link from 'next/link';

import { setIdentifyConsent } from '@/features/consent/actions.mjs';
import { reloadDocument } from '@/features/consent/reloadDocument.mjs';

/**
 * The profile switch for the account link (#617). One click either way: it
 * withdraws the consent as easily as the signup box gave it (GDPR Art. 7(3)).
 *
 * After a saved change the page ends the document with one full navigation: a
 * running recorder cannot be stopped, and identify() must not share a page load
 * with it. Turning it off also deletes the visits linked to the account.
 *
 * @param {object} props - Component props.
 * @param {boolean} props.initial - The stored consent.
 * @returns {import('react').ReactElement}
 */
export default function IdentifySwitch({ initial }) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(/** @type {string | null} */ (null));

    const toggle = async () => {
        setPending(true);
        setError(null);
        const result = await setIdentifyConsent(!initial);
        if (!result.ok) {
            setError(Object.values(result.errors ?? {}).join(' ') || 'Could not save.');
            setPending(false);
            return;
        }
        // A failed delete is reported to the operator; the link is off either way.
        if (result.errors?.delete) window.alert(result.errors.delete);
        reloadDocument();
    };

    return (
        <div className="flex flex-col gap-2">
            <h3>Account link</h3>
            <div className="flex items-start gap-3">
                <button
                    type="button"
                    role="switch"
                    aria-checked={initial}
                    aria-labelledby="identify-switch-label"
                    aria-describedby="identify-switch-help"
                    onClick={toggle}
                    disabled={pending}
                    data-umami-event="account-identify-toggle"
                    className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${initial ? 'border-primary bg-primary' : 'border-ghost bg-surface-3'}`}
                >
                    <span
                        aria-hidden="true"
                        className={`inline-block size-4 transition-transform ${initial ? 'translate-x-6 bg-surface-0' : 'translate-x-1 bg-text-muted'}`}
                    />
                </button>
                <div className="flex flex-col gap-1">
                    <span id="identify-switch-label" className="text-body text-text">
                        Link my use of this site to my account
                        <span className="ml-2 font-mono text-small text-text-muted">
                            {initial ? 'On' : 'Off'}
                        </span>
                    </span>
                    <span
                        id="identify-switch-help"
                        className="text-small text-text-muted"
                    >
                        If this is on, the pages you visit and the buttons you use here
                        are linked to your account in our own analytics, so that a problem
                        you report can be traced in your visits. Switch off at any time:
                        switching off deletes the visits linked to your account.{' '}
                        <Link
                            href="/privacy"
                            prefetch={false}
                            data-umami-event="account-identify-privacy"
                            className="text-primary hover:underline"
                        >
                            How this works
                        </Link>
                    </span>
                </div>
            </div>
            {error && (
                <p role="alert" className="text-small text-danger">
                    {error}
                </p>
            )}
        </div>
    );
}
