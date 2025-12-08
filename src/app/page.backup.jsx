import './page.css';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { queryGetRebroadcastStatus } from '@/db/queries/rebroadcast';
import { getCampaign } from '@/db/queries/getCampaign';
//nextjs
import Script from 'next/script';
import Image from 'next/image';
import Link from 'next/link';
//components
import Wings from '@/components/layout/Wings/Wings';
import Button from '@/components/layout/Button/Button';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import War from '@/components/h1/War/War';
import Timeline from '@/components/h1/Timeline/Timeline';
import Active from '@/components/h1/Active/Active';

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

    const data = query;
    if (!query) {
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Loading...
            </div>
        );
    }

    return (
        <>
            <div
                id="hero"
                className="z-10 mb-4 flex flex-col-reverse justify-end sm:mx-24 sm:gap-4 md:flex-row md:gap-8"
            >
                <div className="sm:max-w-1/3 mx-4">
                    {/* className="content box max-h-fit max-w-fit gap-4" */}
                    <section>
                        <h1>
                            <Wings>Online campaign</Wings> tracker for the original
                            Helldivers
                        </h1>
                        <p>
                            This is a fan project that allows you to check the campaign
                            status of the original Helldivers game on the go. <br />
                            It features an up-to-date overview of current campaign,
                            including in-game events and player statistics, alongside the
                            entire history of the past seasons.
                        </p>

                        <p>
                            I am <span className="font-bold">not</span> affiliated with
                            Arrowhead Game Studios or the Helldivers game itself.
                        </p>
                        <Button
                            type="button"
                            label="Detailed Campaign"
                            href="/campaign"
                            umami="hero"
                        />
                    </section>

                    <Active data={data} />
                </div>

                <Galaxy data={data} />

                {/* <Script src="/scripts/reload.js" /> */}
            </div>

            <section id="features" className="relative px-2 sm:px-24">
                <div id="transition" className="z-10"></div>
                <div className="relative flex flex-col gap-4">
                    <h2>Features</h2>
                    <ul>
                        <li className="flex flex-col md:flex-row">
                            <div className="flex min-h-full max-w-fit flex-col items-center justify-center">
                                <h3>Map</h3>
                                <p className="w-full sm:max-w-lg">
                                    An interactive recreation of the in-game sector map,
                                    with the current campaign's progress highlighted. You
                                    can see the captured regions, the progress of the
                                    currently contested regions, and which regions have
                                    active events in them.
                                </p>
                            </div>
                            <div className="flex flex-grow gap-2">
                                {/* <Image
                                    src="/images/features-map.png"
                                    width={300}
                                    height={300}
                                    alt="circular galactic map divided into sectors, colored in gold for captured, gray for lost and in the faction color for contested."
                                /> */}
                                {/* <Image src="/images/map.png" width={300} height={300} />
                                <Image src="/images/map.png" width={300} height={300} /> */}
                            </div>
                        </li>
                        <li>
                            <h3>Timeline</h3>
                            <p>
                                A list of the current campaign's events in chronological
                                order. You can see when they started and ended, as well as
                                the required point count. During active events, it also
                                shows extexted progress, whether we are behind or ahead of
                                schedule.
                            </p>
                            {/* <Image
                                src="/images/features-timeline.png"
                                width={300}
                                height={300}
                                alt="circular galactic map divided into sectors, colored in gold for captured, gray for lost and in the faction color for contested."
                            /> */}
                        </li>
                        <li>
                            <h3>Stats</h3>
                            <p>
                                Show the current campaign's progress and stats, with
                                player deaths, kills etc...
                            </p>
                        </li>
                    </ul>
                </div>
            </section>

            <section
                id="about"
                className="flex flex-col gap-4 px-2 py-12 sm:px-24 md:flex-row"
            >
                <div className="flex flex-grow-0 flex-col">
                    <h2>About the project</h2>
                    <p>
                        I am Andrei Lavrenov, the developer of this project. I made it as
                        a way to give back to the{' '}
                        <Link href="">Helldivers Discord community</Link>.
                    </p>

                    <p>
                        The Helldivers video game is a top-down cooperative shooter game
                        where players fight to protect Super Earth from Xeno threats. It
                        is a 2D side-scrolling shooter with a unique storyline and a vast
                        universe of planets, each with its own set of enemies and
                        objectives.
                    </p>
                    <p>
                        The Helldivers API is a RESTful API that provides access to the
                        game's data, including campaign status, statistics, and replays.
                        It is designed to be used by third-party developers to build their
                        own applications and games.
                    </p>
                    <p>
                        The Helldivers Discord bot is a Discord bot that provides updates
                        about in-game events and statistics. It is designed to be used by
                        players and developers to stay up-to-date with the latest
                        developments in the game.
                    </p>
                </div>

                <div className="flex-grow-1 flex flex-wrap">
                    images of:
                    <span> - nextjs logo</span>
                    <span> - postgresql logo</span>
                    <span> - prisma logo</span>
                    <span> - next-auth logo</span>
                    <span> - docker logo</span>
                    <span> - github logo</span>
                    <span> - tailwindcss logo</span>
                    <span> - helldivers logo</span>
                    <span> - umami logo</span>
                    <span> - kofi logo</span>
                    <span> - aws logo</span>
                    <span> - hetzner logo</span>
                    <span> - cloudflare logo</span>
                    <span> - CICD logo</span>
                    <span> - GHCR logo</span>
                </div>
            </section>

            <section id="roadmap" className="flex flex-col gap-4 px-2 py-12 sm:px-24">
                <h2>Roadmap</h2>
                <ul>
                    <li>
                        <h3>History</h3>
                        <p>show past campaigns in detail, with animated map etc...</p>
                    </li>
                    <li>
                        <h3>Web Notifications</h3>
                        <p>
                            get notified at the start of a new campaign and attack or
                            defend events
                        </p>
                    </li>
                    <li>
                        <h3>Campaign Stats</h3>
                        <p>Show the current campaign's </p>
                    </li>
                </ul>
            </section>
        </>
    );
}
