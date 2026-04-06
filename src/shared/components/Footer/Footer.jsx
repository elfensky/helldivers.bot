import './Footer.css';
import Image from 'next/image';

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
                        >
                            Andrei Lavrenov
                        </a>
                    </div>
                    <a
                        href="https://ko-fi.com/H2H610Q1K"
                        target="_blank"
                        rel="noopener noreferrer"
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
                            <a href="/" className="footer-link">
                                Campaign
                            </a>
                        </li>
                        <li>
                            <a href="/archives" className="footer-link">
                                Archives
                            </a>
                        </li>
                        <li>
                            <a href="/docs" className="footer-link">
                                Docs
                            </a>
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
                <span>Ministry of Truth</span>
                <span>
                    Not affiliated with Arrowhead Game Studios or Sony Interactive
                    Entertainment
                </span>
            </div>
        </footer>
    );
}
