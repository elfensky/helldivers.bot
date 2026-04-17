'use client';

const BORDER_CLASSES = {
    primary: 'border-primary text-primary hover:bg-primary hover:text-surface-0',
    'faction-bugs':
        'border-faction-bugs text-faction-bugs hover:bg-faction-bugs hover:text-surface-0',
    'faction-cyborgs':
        'border-faction-cyborgs text-faction-cyborgs hover:bg-faction-cyborgs hover:text-surface-0',
    'faction-illuminate':
        'border-faction-illuminate text-faction-illuminate hover:bg-faction-illuminate hover:text-surface-0',
};

export default function ToggleButton({
    active = true,
    onClick,
    borderColor = 'primary',
    className = '',
    children,
    ...rest
}) {
    const colorClasses = BORDER_CLASSES[borderColor] ?? BORDER_CLASSES.primary;
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex size-[40px] cursor-pointer items-center justify-center border font-mono transition-colors md:size-[30px] ${colorClasses} ${active ? '' : 'opacity-40'} ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}
