'use client';

const VARIANT = {
    primary: 'border-primary text-primary hover:bg-primary hover:text-surface-0',
    danger: 'border-danger text-danger hover:bg-danger hover:text-surface-0',
    success: 'border-success text-success hover:bg-success hover:text-surface-0',
    ghost: 'border-ghost text-text-muted hover:text-text',
    'faction-bugs':
        'border-faction-bugs text-faction-bugs hover:bg-faction-bugs hover:text-surface-0',
    'faction-cyborgs':
        'border-faction-cyborgs text-faction-cyborgs hover:bg-faction-cyborgs hover:text-surface-0',
    'faction-illuminate':
        'border-faction-illuminate text-faction-illuminate hover:bg-faction-illuminate hover:text-surface-0',
};

const SIZE = {
    icon: 'size-[40px] md:size-[30px] font-mono',
    sm: 'px-2 py-0.5 text-small font-semibold',
    md: 'px-3 py-1.5 text-small font-semibold',
    lg: 'px-4 py-2 text-body font-semibold',
};

export default function Button({
    variant = 'ghost',
    size = 'sm',
    active = true,
    onClick,
    disabled = false,
    type = 'button',
    className = '',
    children,
    ...rest
}) {
    const variantClasses = VARIANT[variant] ?? VARIANT.ghost;
    const sizeClasses = SIZE[size] ?? SIZE.sm;
    const opacityClass = active ? '' : 'opacity-40';

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex cursor-pointer items-center justify-center border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses} ${variantClasses} ${opacityClass} ${className}`}
            {...rest}
        >
            {children}
        </button>
    );
}
