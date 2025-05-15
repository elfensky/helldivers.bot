import Image from 'next/image';
import Galaxy from '@/components/h1/Galaxy';

export default function HomePage() {
    return (
        <div class="flex min-h-full w-full flex-row">
            <section>stats</section>
            <Galaxy />
        </div>
    );
}
