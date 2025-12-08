import Image from 'next/image';

export default function Footer() {
    const now = new Date();
    const year = now.getFullYear();

    return (
        <footer className="slide z-20 flex w-full flex-col justify-between gap-4 px-2 py-12 sm:flex-row sm:px-24">
            <section className="flex flex-col gap-2">
                <div className="flex flex-col">
                    <h4>Helldivers Bot</h4>
                    <p>The best way to track progress in Helldivers</p>
                </div>
                <div className="flex flex-col">
                    <span>Contact me through Github or via my Portfolio</span>
                    <span>
                        © {year} <a href="https://lavrenov.io">Andrei Lavrenov</a>
                    </span>
                </div>

                {/* <span>
                        ✉️ <a href="mailto:info@helldivers.bot">info@helldivers.bot</a>
                    </span> */}
                <a href="https://ko-fi.com/H2H610Q1K" target="_blank">
                    {/* <img
                        style={{ border: '0px', height: '36px' }}
                        src="https://storage.ko-fi.com/cdn/kofi2.png?v=6"
                        border="0"
                    /> */}
                    <Image
                        src="/images/kofi.webp"
                        width="143"
                        height="36"
                        alt="Buy Me a Coffee at ko-fi.com"
                        loading="lazy"
                    />
                </a>
            </section>

            <div id="sitemap" className="flex flex-col gap-4 sm:flex-row">
                <section id="sitemap-legal">
                    <h4>Legal</h4>
                    <ul>
                        <li>
                            <a href="">Terms of Use</a>
                        </li>
                        <li>
                            <a href="">Privacy Policy</a>
                        </li>
                        <li>
                            <a href="">Bug Bounty</a>
                        </li>
                        <li>
                            <a href="">Cookies</a>
                        </li>
                    </ul>
                </section>
                <section id="sitemap-features">
                    <h4>Features</h4>
                    <ul>
                        <li>
                            <a href="">Campaign</a>
                        </li>
                        <li>
                            <a href="">History</a>
                        </li>
                        <li>
                            <a href="">Discord Bot</a>
                        </li>
                        <li>
                            <a href="">Stats</a>
                        </li>
                        <li>
                            <a href="">API</a>
                        </li>
                    </ul>
                </section>
                <section id="sitemap-social">
                    <h4>Social</h4>
                    <ul>
                        <li>
                            <a href="https://discord.gg/fu3TJyufFd">Helldivers Discord</a>
                        </li>
                        <li>
                            <a href="">Github</a>
                        </li>
                        <li>
                            <a href="">Twitter</a>
                        </li>
                    </ul>
                </section>
            </div>
        </footer>
    );
}
