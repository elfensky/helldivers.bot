export default function Footer() {
    const now = new Date();
    const year = now.getFullYear();

    return (
        <footer className="flex flex-col items-center justify-between bg-indigo-950">
            <div className="flex flex-row flex-wrap gap-8">
                <ul className="flex flex-col gap-2 text-sm">
                    <li>Cookies</li>
                    <li>Reviews</li>
                    <li>Docs</li>
                </ul>
                <ul className="flex flex-col gap-2 text-sm">
                    <h3>Info</h3>
                    <li>About</li>
                    <li>Features</li>
                    <li>Bot</li>
                </ul>
                <ul className="flex flex-col gap-2 text-sm">
                    <h3>Social</h3>
                    <li>Discord</li>
                    <li>GitHub</li>
                    <li>Twitter</li>
                </ul>
            </div>
            <span className="flex items-center justify-center gap-4">
                © <a href="https://lavrenov.io">Andrei Lavrenov</a> {year}
            </span>
        </footer>
    );
}
