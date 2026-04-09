/**
 * Shared event card shell — status-colored accent bar + background.
 * Used by LiveEvent (dashboard) and ArchiveEvent (archives).
 */

export const STATUS_STYLES = {
    success: {
        bg: 'bg-success-tint/40',
        border: 'border-ghost',
        accent: 'bg-success',
        card: '',
        pill: 'bg-success/10 text-success border border-success/20',
    },
    fail: {
        bg: 'bg-surface-1',
        border: 'border-ghost',
        accent: 'bg-ghost',
        card: '',
        pill: 'bg-surface-3 text-text-muted border border-ghost',
    },
    active: {
        bg: 'bg-danger-tint/50',
        border: 'border-ghost',
        accent: 'bg-danger',
        card: 'animate-[card-flash_3s_ease-in-out_infinite] motion-reduce:animate-none',
        pill: 'bg-danger/12 text-danger border border-danger/25 animate-[pill-flash_1.5s_ease-in-out_infinite] motion-reduce:animate-none',
    },
};

export default function EventCardLayout({
    status,
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
    className = '',
}) {
    const s = STATUS_STYLES[status] || STATUS_STYLES.active;

    return (
        <article
            className={`event-card border ${s.border} ${s.bg} ${s.card} ${className}`}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            onKeyDown={
                onClick
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onClick(e);
                          }
                      }
                    : undefined
            }
        >
            {children}
            <div className={`event-card-accent ${s.accent}`} />
        </article>
    );
}
