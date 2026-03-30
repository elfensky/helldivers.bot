import Link from 'next/link';

export default function Button({
    className,
    type,
    href,
    label,
    umami = label.toLowerCase(),
    // aria = `a button linking to ${label}`,
}) {
    if (type === 'link') {
        return (
            <Link
                href={href}
                data-umami-event={'button-' + umami}
                className={
                    'link flex items-center justify-center bg-blue-500 p-1 text-white' +
                    ' ' +
                    className
                }
            >
                {label}
            </Link>
        );
    }

    if (type === 'button') {
        return (
            <Link
                href={href}
                data-umami-event={'button-' + umami}
                className={
                    'button flex w-fit items-center justify-center rounded-md bg-amber-300 px-4 py-2 font-bold text-gray-600 hover:bg-amber-500' +
                    ' ' +
                    className
                }
            >
                {label}
            </Link>
        );
    }

    throw new Error('Unknown type');
}
