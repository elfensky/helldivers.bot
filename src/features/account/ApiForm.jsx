'use client';
import { useState } from 'react';
import Form from 'next/form';
import { useActionState } from 'react';
import { generateApiKey, deleteApiKey } from '@/db/queries/api';
import Button from '@/shared/components/Button/Button';

const MAX_DESCRIPTION_LENGTH = 32;

export function GenerateApiKeyForm({ userId }) {
    if (!userId) {
        return <div>CreateApiKey - No user found</div>;
    }

    const [state, formAction, pending] = useActionState(generateApiKey, null);
    const [descLength, setDescLength] = useState(0);

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
                            <span
                                id="description-error"
                                className="ml-2 text-body text-danger"
                            >
                                {state.errors.description}
                            </span>
                        :   null}
                    </label>
                    <input
                        type="text"
                        id="description"
                        name="description"
                        placeholder="e.g. My Discord Bot"
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        onChange={(e) => setDescLength(e.target.value.length)}
                        size={MAX_DESCRIPTION_LENGTH}
                        className="bg-surface-2 px-3 py-2 text-body text-text placeholder:text-text-muted"
                        aria-describedby={
                            state?.errors?.description ? 'description-error' : undefined
                        }
                    />
                    <span
                        className={`text-small ${descLength >= MAX_DESCRIPTION_LENGTH ? 'text-danger' : 'text-text-muted'}`}
                    >
                        {descLength}/{MAX_DESCRIPTION_LENGTH}
                    </span>
                </fieldset>

                <Button type="submit" variant="primary" size="lg" disabled={pending}>
                    Generate
                </Button>
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
                <Button type="submit" variant="danger" disabled={pending}>
                    Delete
                </Button>
            </Form>
        </>
    );
}
