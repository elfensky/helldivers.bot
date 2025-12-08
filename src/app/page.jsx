import './page.css';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { queryGetRebroadcastStatus } from '@/db/queries/rebroadcast';
import { getCampaign } from '@/db/queries/getCampaign';
//nextjs
// import Script from 'next/script';
// import Image from 'next/image';
// import Link from 'next/link';
//components
// import Wings from '@/components/layout/Wings/Wings';
import Button from '@/components/layout/Button/Button';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
// import War from '@/components/h1/War/War';
// import Timeline from '@/components/h1/Timeline/Timeline';
// import Active from '@/components/h1/Active/Active';
import Alerts from '@/components/h1/Alerts/Alerts';
import { formatNumber, addOrdinalSuffix } from '@/utils/utils';

export default async function HomePage() {
    const rebroacast_status = await tryCatch(queryGetRebroadcastStatus());
    const { data: query, error: queryError } = await tryCatch(getCampaign());

    if (queryError !== null) {
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Error: {queryError.message}
            </div>
        );
    }

    if (!query) {
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Loading...
            </div>
        );
    }

    const data = query;

    return (
        <>
            <HeroBackup data={data} />

            <div className="gutters relative mb-8 flex flex-col flex-wrap gap-8">
                <About />
                <Features />
                <Dicord />
                <Api />
                {/* <Roadmap /> */}
                {/* <Buy /> */}
            </div>
            {/* <div className="gutters relative flex px-2 sm:px-24">
                <section id="discord" className="bg-pink-300">
                    discord bot
                </section>
                <section id="api" className="bg-rose-500">
                    api
                </section>
            </div>

            <div className="gutters relative flex px-2 sm:px-24">
                <section id="game" className="bg-green-600">
                    game
                </section>
                <section id="roadmap" className="bg-indigo-500">
                    roadmap
                </section>
            </div> */}
        </>
    );
}

function Hero({ data }) {
    const ButtonText = `Check the ${addOrdinalSuffix(data.season)} War Report`;

    return (
        <div
            id="hero"
            className="z-0 grid h-[calc((100vh-50px)*1.111)] grid-cols-10 grid-rows-10 md:h-[calc(95vh-80px)]"
            //the height is /9*10 === *1.111 -> so that the first 9 cells take up (100vh-50px) and another cell remains below the fold.
        >
            bla
        </div>
    );
}

function HeroBackup({ data }) {
    const ButtonText = `Check the ${addOrdinalSuffix(data.season)} War Report`;

    return (
        <div
            id="hero"
            className="z-0 grid h-[calc((100vh-50px)*1.111)] grid-cols-10 grid-rows-10 md:h-[calc(95vh-80px)]"
            //the height is /9*10 === *1.111 -> so that the first 9 cells take up (100vh-50px) and another cell remains below the fold.
        >
            <section
                id="alerts"
                style={{ padding: 0 }}
                className="z-40 col-start-1 col-end-11 row-start-1 row-end-3 flex h-1/2 overflow-hidden overflow-x-scroll p-0"
            >
                <Alerts data={data} />
            </section>

            <section
                id="info"
                className="z-20 col-start-1 col-end-11 row-start-2 row-end-7 sm:z-30 md:col-end-7 lg:row-end-9 2xl:col-end-6"
            >
                <div className="ml-4 mr-4 flex h-full flex-col gap-4 sm:ml-12 sm:mr-12 md:mr-0 lg:ml-24 lg:mr-0 xl:gap-8">
                    <h1 className="text-4xl sm:text-5xl lg:text-7xl">
                        TRACK MANAGED DEMOCRACY ACROSS THE GALAXY
                    </h1>
                    <p className="max-w-[550px] md:text-[18px]">
                        Don’t miss a moment of the action! Follow the Helldivers’ campaign
                        progress as they battle for peace, liberty, and managed democracy.
                        See which planets are under siege, which are liberated, and where
                        your next mission awaits.
                    </p>
                    <Button umami="hero" type="button" href="/war" label={ButtonText} />
                </div>
            </section>

            <section
                id="stats"
                className="z-10 col-start-1 col-end-11 row-start-10 row-end-11 w-full md:col-end-7 md:row-start-7 lg:col-end-11 lg:row-start-9"
            >
                <div className="ml-4 mr-4 flex h-full flex-wrap items-center justify-between sm:ml-12 sm:mr-12 md:mr-0 lg:ml-24 lg:mr-24">
                    <HeroStats data={data} />
                </div>
            </section>

            <section
                id="map"
                className="z-30 col-start-1 col-end-11 row-start-6 row-end-10 overflow-hidden rounded-none sm:z-10 md:col-start-6 md:row-start-2 md:row-end-11 lg:row-start-1"
            >
                <Galaxy data={data} />
            </section>
        </div>
    );
}

function HeroStats({ data }) {
    const players = data.statistics.reduce((total, enemy) => total + enemy.players, 0);
    const successful_missions = data.statistics.reduce(
        (total, enemy) => total + enemy.successful_missions,
        0,
    );
    const deaths = data.statistics.reduce((total, enemy) => total + enemy.deaths, 0n);
    const kills = data.statistics.reduce((total, enemy) => total + enemy.kills, 0n);

    return (
        <>
            <div className="flex w-1/4 flex-col md:w-1/2 lg:w-fit">
                <span className="text-3xl sm:text-4xl">{formatNumber(players)}</span>
                <span>Players Online</span>
            </div>
            <div className="flex w-1/4 flex-col md:w-1/2 lg:w-fit">
                <span className="text-3xl sm:text-4xl">
                    {formatNumber(successful_missions)}
                </span>
                <span>Missions Completed</span>
            </div>
            <div className="flex w-1/4 flex-col md:w-1/2 lg:w-fit">
                <span className="text-3xl sm:text-4xl">{formatNumber(deaths)}</span>
                <span>Fallen in Combat</span>
            </div>
            <div className="flex w-1/4 flex-col md:w-1/2 lg:w-fit">
                <span className="text-3xl sm:text-4xl">{formatNumber(kills)}</span>
                <span>Enemies killed</span>
            </div>
        </>
    );
}

function About() {
    return (
        <section
            id="about"
            className="card sm:max-w-1/3 w-full rounded-md p-2 sm:min-w-[300px] md:p-4"
        >
            <h2 className="text-lg sm:text-xl lg:text-2xl">About</h2>
            <p>
                Hi, I’m Andrei Lavrenov, a Full Stack Developer based in Belgium. As a
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

function Features() {
    return (
        <section
            id="features"
            className="card sm:max-w-2/3 flex w-full flex-col sm:flex-grow"
        >
            <h2 className="text-lg sm:text-xl lg:text-2xl">Features</h2>
            <div className="flex flex-col justify-between gap-8 sm:flex-row">
                <div className="w-1/3">
                    <h3>Interactive Map</h3>
                    <p>Interactive map that shows the in-game campaign progress.</p>
                </div>
                <div className="w-1/3">
                    <h3>Alerts</h3>
                    <p>Clear alerts on the homepage when an event is happening</p>
                </div>
                <div className="w-1/3">
                    <h3>War Report</h3>
                    <p>
                        Dedicated page about the current War with detailed stats and a
                        timeline of events.
                    </p>
                </div>
            </div>
        </section>
    );
}

function Dicord() {
    return (
        <section id="discord" className="card sm:max-w-1/2 w-full rounded-md p-2 md:p-4">
            <h2 className="text-lg sm:text-xl lg:text-2xl">Discord (Bot)</h2>
            <p>
                While this project started as a discord bot, I learned a lot since, and it
                would require a full rewrite of whatever code exists now. I want to focus
                on finishing and poloshing the website and api first, so I can leave it
                running without worries, and then I will rewrite the bot.
            </p>
            <p>insert [screenshot] of bot from my server</p>
            <p>
                In the meantime, go ahead and join the official{' '}
                <a href="https://discord.gg/fu3TJyufFd">Helldivers Discord Server</a>
            </p>
        </section>
    );
}

function Api() {
    return (
        <section id="api" className="card sm:max-w-1/2 w-full">
            <h2 className="text-lg sm:text-xl lg:text-2xl">API</h2>
            <p>
                Log in to create an api key so you can use the Helldivers API for your own
                purposes. Use my API to avoid overloading the official server, so I can
                act as a cache.
            </p>
            <p>
                In the meantime, read the
                <a href="/docs">Docs</a>
                or the
                <a href="/api">API Specification</a>
            </p>
        </section>
    );
}

function Roadmap() {
    return (
        <section id="roadmap" className="card sm:max-w-1/2 w-full">
            <h2 className="text-lg sm:text-xl lg:text-2xl">Roadmap</h2>
            <p>list of future features, perhaps autogenerated from github issues</p>
            <p>something about feature requests should come in as issues on github</p>
            <a href="https://github.com/elfensky/helldivers1api/issues">Github Issues</a>
        </section>
    );
}

function Buy() {
    return (
        <section id="buy" className="card sm:max-w-1/2 w-full">
            <h2 className="text-lg sm:text-xl lg:text-2xl">Play</h2>
            <p>Game cheap, fun, good reviews, (local) co-op fun with friends</p>
            <p>show lowest price on Steam/PSN from trackers</p>
            <a href="https://store.steampowered.com/agecheck/app/394510/">Steam</a>
            <a href="https://store.playstation.com/en-us/product/UP9000-CUSA02945_00-HELLDIVERSSCEA00">
                PSN
            </a>
        </section>
    );
}
