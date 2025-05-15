import Link from 'next/link';

// read more:
// https://nextjs.org/docs/app/api-reference/file-conventions/not-found

export default function NotFound() {
    return (
        <div>
            <h2>Not Found</h2>
            <p>Could not find requested resource</p>
            <Link href="/">Return Home</Link>
        </div>
    );
}
