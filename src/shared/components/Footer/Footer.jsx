import './Footer.css';
import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-inner p-gutters">
                <div className="footer-brand">
                    <span className="footer-brand-name">Ministry of Truth</span>
                    <p className="footer-brand-tagline">
                        Super Earth&apos;s #1 source for approved galactic intelligence.
                    </p>
                    <div className="footer-brand-contact">
                        <span>Contact me through Github or via my Portfolio</span>
                    </div>
                    <div className="footer-brand-contact">
                        © {year}{' '}
                        <a
                            href="https://lavrenov.io"
                            target="_blank"
                            rel="noopener noreferrer"
                            data-umami-event="footer-portfolio"
                        >
                            Andrei Lavrenov
                        </a>
                    </div>
                    <a
                        href="https://ko-fi.com/H2H610Q1K"
                        target="_blank"
                        rel="noopener noreferrer"
                        data-umami-event="footer-kofi"
                    >
                        <Image
                            src="/images/kofi.webp"
                            width="143"
                            height="36"
                            alt="Buy Me a Coffee at ko-fi.com"
                            loading="lazy"
                        />
                    </a>
                </div>

                <nav>
                    <div className="footer-section-label">Features</div>
                    <ul className="footer-links">
                        <li>
                            <Link href="/" prefetch={false} data-umami-event="footer-campaign" className="footer-link">
                                Campaign
                            </Link>
                        </li>
                        <li>
                            <Link href="/archives" prefetch={false} data-umami-event="footer-archives" className="footer-link">
                                Archives
                            </Link>
                        </li>
                        <li>
                            <Link href="/docs" prefetch={false} data-umami-event="footer-docs" className="footer-link">
                                Docs
                            </Link>
                        </li>
                    </ul>
                </nav>

                <nav>
                    <div className="footer-section-label">Social</div>
                    <ul className="footer-links">
                        <li>
                            <a
                                href="https://discord.gg/fu3TJyufFd"
                                className="footer-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-umami-event="footer-discord"
                            >
                                Helldivers Discord
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/elfensky/helldivers.bot"
                                className="footer-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-umami-event="footer-github"
                            >
                                Github
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://x.com/elfensky"
                                className="footer-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-umami-event="footer-twitter"
                            >
                                Twitter
                            </a>
                        </li>
                        <li>
                            <a
                                href="https://github.com/elfensky/helldivers.bot/issues"
                                className="footer-link"
                                target="_blank"
                                rel="noopener noreferrer"
                                data-umami-event="footer-bugs"
                            >
                                Report Bugs
                            </a>
                        </li>
                    </ul>
                </nav>

                <nav>
                    <div className="footer-section-label">Legal</div>
                    <ul className="footer-links">
                        <li>
                            <span className="footer-link--disabled">Terms of Use</span>
                        </li>
                        <li>
                            <span className="footer-link--disabled">Privacy Policy</span>
                        </li>
                        <li>
                            <span className="footer-link--disabled">Cookies</span>
                        </li>
                    </ul>
                </nav>
            </div>

            <div className="footer-separator p-gutters">
                <div className="flex flex-col gap-1">
                    <span>Ministry of Truth</span>
                    <span className="text-[0.625rem] normal-case tracking-normal opacity-50">
                        v{process.env.NEXT_PUBLIC_APP_VERSION} &ndash;{' '}
                        {process.env.NEXT_PUBLIC_COMMIT_SHA}
                    </span>
                    <span className="text-[0.625rem] normal-case tracking-normal opacity-50">
                        {process.env.NEXT_PUBLIC_COMMIT_MESSAGE}
                    </span>
                </div>
                <span>
                    Not affiliated with Arrowhead Game Studios or Sony Interactive
                    Entertainment
                </span>
            </div>
        </footer>
    );
}
