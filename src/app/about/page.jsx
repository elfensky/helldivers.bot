import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import DocsClient from '@/components/layout/OpenAPI/DocsClient';

export const metadata = {
    title: 'About | Helldivers Bot',
    description:
        'About helldivers.bot — a community project tracking the Helldivers 1 galactic campaign.',
    alternates: { canonical: '/about' },
    openGraph: { url: '/about' },
};

export default function AboutPage() {
    const filePath = path.join(process.cwd(), 'public', 'openapi.json');
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    const openapi = JSON.parse(jsonData);

    return (
        <div className="gutters relative mb-8 flex flex-col flex-wrap gap-8">
            <h1 className="font-[family-name:var(--font-display)] text-3xl">About</h1>
            <About />
            <Architecture />
            <Discord />
            <Api />
            <Docs openapi={openapi} />
        </div>
    );
}

function About() {
    return (
        <section
            id="about"
            className="card w-full rounded-md p-2 sm:max-w-1/3 sm:min-w-[300px] md:p-4"
        >
            <h2 className="font-[family-name:var(--font-display)]">The Project</h2>
            <p>
                Hi, I'm Andrei Lavrenov, a Full Stack Developer based in Belgium. As a
                passionate Helldivers player who earned the platinum trophy on
                PlayStation, I wanted to give back to the amazing Discord community by
                creating a tool to showcase in-game stats and campaign status.
            </p>
            <p>
                What started as a Discord bot project quickly grew into helldivers.bot — a
                dedicated website that pulls data from the Helldivers API to keep players
                informed and connected.
            </p>
            <p>
                I work on this project in my spare time as a hobby, combining my love for
                the game with my passion for coding and learning new technologies.
            </p>
        </section>
    );
}

function Architecture() {
    return (
        <section className="card w-full rounded-md p-2 sm:max-w-1/2 md:p-4">
            <h2 className="font-[family-name:var(--font-display)]">Architecture</h2>
            <p>
                Curious how the data pipeline works? See the interactive diagram showing
                how data flows from the official Helldivers API through validation,
                storage, and normalization to the frontend.
            </p>
            <Link
                href="/architecture"
                prefetch={false}
                className="mt-2 inline-block text-[var(--color-primary)] hover:underline"
            >
                View data flow diagram &rarr;
            </Link>
        </section>
    );
}

function Discord() {
    return (
        <section id="discord" className="card w-full rounded-md p-2 sm:max-w-1/2 md:p-4">
            <h2 className="font-[family-name:var(--font-display)]">Discord (Bot)</h2>
            <p>
                While this project started as a discord bot, I learned a lot since, and it
                would require a full rewrite of whatever code exists now. I want to focus
                on finishing and polishing the website and api first, so I can leave it
                running without worries, and then I will rewrite the bot.
            </p>
            <p>
                In the meantime, go ahead and join the official{' '}
                <a href="https://discord.gg/fu3TJyufFd">Helldivers Discord Server</a>
            </p>
        </section>
    );
}

function Api() {
    return (
        <section id="api" className="card w-full sm:max-w-1/2">
            <h2 className="font-[family-name:var(--font-display)]">API</h2>
            <p>
                Log in to create an api key so you can use the Helldivers API for your own
                purposes. Use my API to avoid overloading the official server, so I can
                act as a cache.
            </p>
        </section>
    );
}

function Docs({ openapi }) {
    return (
        <section id="docs" className="w-full">
            <h2 className="font-[family-name:var(--font-display)]">API Documentation</h2>
            <DocsClient spec={openapi} />
        </section>
    );
}
