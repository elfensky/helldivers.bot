export default function Wings({ as = 'h2', children }) {
    const Heading = as;

    return <Heading className="flex w-full flex-col items-center">{children}</Heading>;
}
