'use client';
import Form from 'next/form';
import { useActionState } from 'react';
import { generateApiKey, deleteApiKey } from '@/db/queries/api';

export function GenerateApiKeyForm({ userId }) {
    if (!userId) {
        return <div>CreateApiKey - No user found</div>;
    }

    const [state, formAction, pending] = useActionState(generateApiKey, null);

    return (
        <>
            {state?.data?.key ?
                <span className="font-mono text-body text-text">
                    Key: {state.data.key}
                </span>
            :   null}
            {state?.errors?.general ?
                <span role="alert" className="text-body text-danger">
                    {state.errors.general}
                </span>
            :   null}

            <Form action={formAction} className="flex flex-row items-end gap-2">
                <input type="text" name="userId" value={userId} readOnly hidden />
                <fieldset className="flex flex-1 flex-col">
                    <label htmlFor="description">
                        Key Name
                        {state?.errors?.description ?
                            <span id="description-error" className="ml-2 text-body text-danger">
                                {state.errors.description}
                            </span>
                        :   null}
                    </label>
                    <input
                        type="text"
                        id="description"
                        name="description"
                        placeholder="e.g. My Discord Bot, Personal Project"
                        className="w-full bg-surface-2 px-3 py-2 text-body text-text placeholder:text-text-muted"
                        aria-describedby={
                            state?.errors?.description ? 'description-error' : undefined
                        }
                    />
                </fieldset>

                <button
                    className="cursor-pointer border border-primary px-4 py-2 text-body font-semibold text-primary hover:bg-primary hover:text-surface-0 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={pending}
                >
                    Generate
                </button>
            </Form>
        </>
    );
}

export function DeleteApiKeyForm({ userId, apikeyId }) {
    if (!userId || !apikeyId) {
        return <div className="flex items-center justify-center text-danger">Error</div>;
    }

    const [state, formAction, pending] = useActionState(deleteApiKey, null);
    return (
        <>
            {state?.errors?.auth ?
                <span className="text-body text-danger">{state.errors.auth}</span>
            :   null}
            <Form action={formAction}>
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="apikeyId" value={apikeyId} />
                <button
                    type="submit"
                    disabled={pending}
                    className="cursor-pointer text-body text-danger hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Delete
                </button>
            </Form>
        </>
    );
}
