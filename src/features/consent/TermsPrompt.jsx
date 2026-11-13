'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';

import Button from '@/shared/components/Button/Button';
import { acceptTerms } from '@/features/consent/actions.mjs';
import { reloadDocument } from '@/features/consent/reloadDocument.mjs';

/**
 * The signup and next-login page (#617): two boxes, both empty. Box 1 accepts the
 * terms and is required. Box 2 is the optional consent to the account link; it
 * says in one plain sentence what is linked and links to /privacy. "Terms only"
 * is one tick less than "both", with the same button.
 *
 * On success the page ends the document with one full navigation, not
 * router.refresh(): a recorder may run in this document, and with box 2 ticked
 * the next load calls identify() instead (replay and identity never share a page
 * load).
 *
 * @returns {import('react').ReactElement}
 */
export default function TermsPrompt() {
    const [state, formAction, pending] = useActionState(
        acceptTerms,
        /** @type {import('@/features/consent/actions.mjs').ConsentActionState} */ ({}),
    );

    useEffect(() => {
        if (state.ok) reloadDocument();
    }, [state.ok]);

    const error = state.errors?.terms ?? state.errors?.general ?? state.errors?.auth;

    return (
        <div className="gutters mx-auto flex max-w-2xl flex-col gap-6 py-8 sm:py-12">
            <header className="flex flex-col gap-2">
                <h1 className="font-display text-h1 text-text uppercase">
                    Enlistment papers
                </h1>
                <p className="text-body text-text-muted">
                    Before you continue, Helldiver, High Command needs your signature. You
                    see this page once: at signup, or at your first login after the terms
                    arrived.
                </p>
            </header>

            <form action={formAction} className="flex flex-col gap-5">
                <label className="flex items-start gap-3 border border-ghost p-4">
                    <input
                        type="checkbox"
                        name="terms"
                        required
                        className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <span className="flex flex-col gap-1 text-body text-text">
                        <span>
                            I accept the{' '}
                            <Link
                                href="/legal#terms"
                                prefetch={false}
                                data-umami-event="consent-terms-read"
                                className="text-primary hover:underline"
                            >
                                terms of service
                            </Link>{' '}
                            of this Ministry of Truth broadcast terminal. (Required.)
                        </span>
                        <span className="text-text-muted">
                            This site comes with no warranty.
                        </span>
                        <span className="text-text-muted">
                            There is no guaranteed uptime.
                        </span>
                    </span>
                </label>

                <label className="flex items-start gap-3 border border-ghost p-4">
                    <input
                        type="checkbox"
                        name="identify"
                        className="mt-1 size-4 shrink-0 accent-primary"
                    />
                    <span className="flex flex-col gap-1 text-body text-text">
                        <span>
                            The Ministry of Truth wants to know who you are. (Optional.)
                        </span>
                        <span className="text-text-muted">
                            If you tick this, the pages you visit and the buttons you use
                            here are linked to your account in our own analytics, so that
                            a problem you report can be traced in your visits. You can
                            switch it off on your profile page at any time.{' '}
                            <Link
                                href="/privacy"
                                prefetch={false}
                                data-umami-event="consent-terms-privacy"
                                className="text-primary hover:underline"
                            >
                                How this works
                            </Link>
                        </span>
                    </span>
                </label>

                {error && (
                    <p role="alert" className="text-small text-danger">
                        {error}
                    </p>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={pending}
                    data-umami-event="consent-terms-submit"
                    className="w-fit"
                >
                    {pending ? 'Filing…' : 'Report for duty'}
                </Button>
            </form>
        </div>
    );
}
