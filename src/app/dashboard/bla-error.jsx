'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';

export default function Error({ error, reset }) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div>
            <h2>Something went wrong!</h2>
            <button
                onClick={
                    // Attempt to recover by trying to re-render the segment
                    () => reset()
                }
            >
                Try again
            </button>
        </div>
    );
}

//read more
// https://nextjs.org/docs/app/api-reference/file-conventions/error
// https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
