'use client';

function DetailSection({ section }) {
    if (section.type === 'text') {
        return <p>{section.content}</p>;
    }
    if (section.type === 'heading') {
        return <h4 className="diagram-detail-heading">{section.content}</h4>;
    }
    if (section.type === 'code') {
        return <pre>{section.content}</pre>;
    }
    if (section.type === 'tags') {
        return (
            <div>
                {section.items.map((tag) => (
                    <span key={tag.text} className={`diagram-tag ${tag.cls}`}>
                        {tag.text}
                    </span>
                ))}
            </div>
        );
    }
    if (section.type === 'table') {
        return (
            <table className="diagram-schema-table">
                <thead>
                    <tr>
                        {section.headers.map((h) => (
                            <th key={h}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {section.rows.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => (
                                <td key={j}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    }
    return null;
}

export default function DetailPanel({ data, onClose }) {
    const isOpen = Boolean(data);

    return (
        <>
            <div
                className={`diagram-detail-overlay ${isOpen ? 'open' : ''}`}
                onClick={onClose}
            />
            <div className={`diagram-detail-panel ${isOpen ? 'open' : ''}`}>
                <button
                    className="diagram-detail-close"
                    onClick={onClose}
                    aria-label="Close detail panel"
                >
                    &times;
                </button>
                {data && (
                    <>
                        <h3>{data.title}</h3>
                        <div className="diagram-detail-subtitle">{data.subtitle}</div>
                        {data.sections.map((section, i) => (
                            <DetailSection key={i} section={section} />
                        ))}
                    </>
                )}
            </div>
        </>
    );
}
