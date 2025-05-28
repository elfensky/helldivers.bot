import Image from 'next/image';
import Galaxy from '@/components/h1/Galaxy';
import Stats from '@/components/h1/Stats';

export default async function HomePage() {
    return (
        <div className="flex min-h-full w-full flex-row bg-purple-800">
            <Stats />
            <Galaxy />
        </div>
    );
}
