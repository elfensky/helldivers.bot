import DataFlowDiagram from '@/components/layout/DataFlowDiagram/DataFlowDiagram';

export const metadata = {
    title: 'Architecture | Helldivers Bot',
    description:
        'Data flow architecture diagram for helldivers.bot — see how data moves from the official API through processing and storage to the frontend.',
};

export default function ArchitecturePage() {
    return (
        <div className="gutters relative mb-8 flex flex-col gap-8">
            <h1 className="font-[family-name:var(--font-display)] text-3xl">
                Architecture
            </h1>
            <section className="card w-full p-2 md:p-4">
                <h2 className="font-[family-name:var(--font-display)]">
                    Data Flow Architecture
                </h2>
                <p className="text-[var(--color-text-muted)]">
                    How data moves from the official Helldivers 1 API through validation,
                    storage, and normalization to the frontend. Click any node for
                    details.
                </p>
                <DataFlowDiagram />
            </section>

            <section className="card w-full p-2 md:p-4">
                <h2 className="font-[family-name:var(--font-display)]">Key Concepts</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--color-faction-bugs)]">
                            Two-Table Strategy
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Raw API responses are stored in rebroadcast tables (faithful
                            JSON), while normalized h1_* tables enable filtering, joining,
                            and aggregation. Both coexist to avoid trade-offs.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--color-primary)]">
                            Worker Thread
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            A dedicated thread polls the official API every 5-15 seconds
                            using setTimeout (not setInterval) to prevent overlapping
                            requests. Validates with Zod before any database writes.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--color-success)]">
                            Confirm Pattern
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Each update cycle creates an unconfirmed season row, writes
                            all child data, then confirms by setting last_updated. This
                            ensures partial writes are detectable.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--color-faction-illuminate)]">
                            On-Demand Fetching
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)]">
                            Missing seasons are fetched from the official API on first
                            request. The /archives page derives available seasons from the
                            current season number, not a database query.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
