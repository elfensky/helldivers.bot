'use client';
import './ApiForm.css';
import Form from 'next/form'; //form component
import { useActionState } from 'react'; //hook to do forms with NextJs
import { generateApiKey, deleteApiKey } from '@/db/queries/api'; //server action

export function GenerateApiKeyForm({ userId }) {
    if (!userId) {
        return <div>CreateApiKey - No user found</div>;
    }

    const [state, formAction, pending] = useActionState(generateApiKey, null);

    return (
        <>
            {state?.data?.key ?
                <span>Key: {state?.data?.key}</span>
            :   null}
            {state?.errors?.general ?
                <span role="alert" className="text-red-400">
                    {state.errors.general}
                </span>
            :   null}

            <Form action={formAction} className="flex flex-row gap-2">
                <input type="text" name="userId" value={userId} readOnly hidden />
                <fieldset className="flex flex-col">
                    <label htmlFor="description">
                        Description
                        {state?.errors?.description ?
                            <span
                                id="description-error"
                                className="ml-2 text-red-400"
                            >
                                {state.errors.description}
                            </span>
                        :   null}
                    </label>
                    <input
                        type="text"
                        id="description"
                        name="description"
                        placeholder="used by [application name]"
                        aria-describedby={
                            state?.errors?.description ? 'description-error' : undefined
                        }
                    />
                </fieldset>

                <button className="" disabled={pending}>
                    Generate
                </button>
            </Form>
            {/* {apiKey ? 'Generated key: ' + apiKey : null} */}
        </>
    );
}

export function DeleteApiKeyForm({ userId, apikeyId }) {
    if (!userId || !apikeyId) {
        return <div className="flex items-center justify-center bg-red-600">Error</div>;
    }

    const [state, formAction, pending] = useActionState(deleteApiKey, null);
    return (
        <>
            {state?.error ?
                <span className="text-red-400">{state.error}</span>
            :   null}
            <Form action={formAction}>
                <input type="hidden" name="userId" value={userId} readOnly hidden />
                <input type="hidden" name="apikeyId" value={apikeyId} readOnly hidden />
                <button type="submit" className="text-red-600">
                    {state?.errors?.auth ?
                        <span className="text-red-400">{state.errors.auth}</span>
                    :   null}
                    Delete
                </button>
            </Form>
        </>
    );
}
