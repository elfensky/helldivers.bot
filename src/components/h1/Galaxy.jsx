import './Galaxy.css';
import Script from 'next/script';

export default function Galaxy() {
    const bugs = [
        'active',
        'active',
        'active',
        'active',
        'active',
        'active',
        'active',
        'active',
        'active',
        'lost',
        'lost',
    ];
    const cyborgs = [
        'active',
        'active',
        'active',
        'active',
        'lost',
        'active',
        'lost',
        'lost',
        'lost',
        'lost',
        'lost',
    ];
    const illuminate = [
        'active',
        'active',
        'active',
        'active',
        'lost',
        'lost',
        'lost',
        'lost',
        'lost',
        'lost',
        'lost',
    ];

    return (
        <section id="map" className="max-w-1/3 aspect-square max-h-screen bg-red-400">
            <svg
                data-name="Layer 2"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 800.42 834.11"
            >
                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow
                            dx="5"
                            dy="5"
                            stdDeviation="2"
                            floodColor="rgba(255,255,0, 1.0)"
                        />
                    </filter>
                    <filter id="glow">
                        <feGaussianBlur
                            className="blur"
                            result="coloredBlur"
                            stdDeviation="4"
                        ></feGaussianBlur>
                        <feMerge>
                            <feMergeNode in="coloredBlur"></feMergeNode>
                            <feMergeNode in="coloredBlur"></feMergeNode>
                            <feMergeNode in="coloredBlur"></feMergeNode>
                            <feMergeNode in="SourceGraphic"></feMergeNode>
                        </feMerge>
                    </filter>
                </defs>
                <g id="bug">
                    <path
                        id="_11-3"
                        data-name="11"
                        className={'sector ' + bugs[11]}
                        d="M795.88,252.13l-110.94-175.61s60.31,84.75,112.98,51.47c0,0-58.88,34.16-2.04,124.14Z"
                    />
                    <path
                        id="_10-3"
                        data-name="10"
                        className={'sector ' + bugs[10]}
                        d="M466.2,5.23s211.35,30.93,279.39,226.92l-25.25,12.02s-38.91-156.29-256.75-207.58l2.61-31.36Z"
                    />
                    <path
                        id="_9-3"
                        data-name="9"
                        className={'sector ' + bugs[9]}
                        d="M660.88,148.04l-28.69,16.28s127.81,120.8,61.08,314.69l61.21,22.19s57.38-111.87-8.89-269.05l-25.25,12.02s-20.6-57.26-59.46-96.12Z"
                    />

                    <path
                        id="_8-3"
                        data-name="8"
                        className={'sector ' + bugs[8]}
                        d="M530.19,92.21l-26.36,60.23s-37.42-17.9-57.62-17.9l5.75-32.4s16.99,1.76,31.66,6.65l18.21-63.14s113.89,36.86,159.04,102.38l-28.69,16.28s-57.01-55.91-101.99-72.11Z"
                    />
                    <path
                        id="_7-3"
                        data-name="7"
                        className={'sector ' + bugs[7]}
                        d="M583.95,209.88s-32.93-41.62-80.12-57.43l26.36-60.23s93.6,39.42,130.68,113.12l-26.44,16.13s-20.37-28.02-27.2-34.85l-23.28,23.28Z"
                    />
                    <path
                        id="_6-3"
                        data-name="6"
                        className={'sector ' + bugs[6]}
                        d="M599.94,445.18s16.27-51.33,10.89-81.81h35.28s-7.36-109.14-62.16-153.49l23.28-23.28s18.76,21.21,27.2,34.85l26.44-16.13s74.69,92.41,44.48,231.23l-64.15-14.38s-4.47,21.21-9.74,34.42l-31.52-11.42Z"
                    />
                    <path
                        id="_5-3"
                        data-name="5"
                        className={'sector ' + bugs[5]}
                        d="M530.19,252.84s-32.56-40.42-95.81-51.6l11.83-66.7s183.07,24.15,199.9,228.82h-35.28s3.24-74.82-53.15-131.22l-27.49,20.7Z"
                    />
                    <path
                        id="_4-3"
                        data-name="4"
                        className={'sector ' + bugs[4]}
                        d="M499.33,276.38l58.35-44.23s87.95,84.32,42.26,213.03l-32.18-11.66s6.15-15.16,8.08-30.31l-38.76-5.81s13.53-69.74-37.75-121.01Z"
                    />
                    <path
                        id="_3-3"
                        data-name="3"
                        className={'sector ' + bugs[3]}
                        d="M470.41,300.36s-13.75-14.82-33.36-19.69l14.91-75.34s44.06,9.58,78.23,47.51l-59.78,47.51Z"
                    />
                    <path
                        id="_2-3"
                        data-name="2"
                        className={'sector ' + bugs[2]}
                        d="M461.57,395.26l34.35,12.49s3.31-9.02,4.35-15.46l36.81,5.1s13.1-72.8-37.75-121.01l-28.91,23.98s28.18,20.66,31.68,65.64l-36.54,5.25s2.09,12.06-3.98,24.01Z"
                    />
                    <path
                        id="_1-3"
                        data-name="1"
                        className={'sector ' + bugs[1]}
                        d="M461.57,395.26s6.09-10.05,3.98-24.01l36.28-5s-2.85-74.24-80.78-89.88l-18.97,97.84,59.49,21.05Z"
                        filter="filter: url(#glow)"
                    />
                </g>

                <g id="cyborg">
                    <path
                        id="_11-2"
                        data-name="11"
                        className={'sector ' + cyborgs[11]}
                        d="M120.5,76.51L2.5,247.46s54.29-88.73,3.01-124.12c0,0,54.53,40.75,114.98-46.83Z"
                    />
                    <path
                        id="_10-2"
                        data-name="10"
                        className={'sector ' + cyborgs[10]}
                        d="M99.85,426.69l-32.74,8.7s1.12,23.69,16.37,50.04l-32.43,11.4S-15.14,335.41,86.01,176.84l56.17,32.95s-64.61,90.59-42.34,216.9Z"
                    />
                    <path
                        id="_9-2"
                        data-name="9"
                        className={'sector ' + cyborgs[9]}
                        d="M142.18,209.78s15.07-29.97,31.77-42.16l-27.75-19.58s48.37-77.14,197.75-111.54l-6.01-34S176.94,29.23,86.01,176.84l56.17,32.95Z"
                    />
                    <path
                        id="_8-2"
                        data-name="8"
                        className={'sector ' + cyborgs[8]}
                        d="M142.18,209.78l27.41,16.43s41.86-95.5,185.81-125.01l-11.44-64.69s-111.87,13.25-197.75,111.54l27.75,19.58s-17.77,15.69-31.77,42.16Z"
                    />
                    <path
                        id="_7-2"
                        data-name="7"
                        className={'sector ' + cyborgs[7]}
                        d="M206.13,442.31l-59.09,24.85s-11.84-14.3-15.55-44.98l-31.64,4.51s-26.85-97.49,42.34-216.9l27.41,16.43s-46.22,75.13-42.16,158.73l67.06-4.01s-1.81,30.96,11.64,61.38Z"
                    />
                    <path
                        id="_6-2"
                        data-name="6"
                        className={'sector ' + cyborgs[6]}
                        d="M249.48,143.91s-116.89,54.62-122.05,241.03l67.59-4.54s-3.82-65.8,33.69-121.97l-27.68-18.62s33.49-54.74,68.97-68.97l-20.52-26.93Z"
                    />
                    <path
                        id="_5-2"
                        data-name="5"
                        className={'sector ' + cyborgs[5]}
                        d="M309.54,186.6l17.59,27.72s14.08-10.24,45.25-13.01l-5.94-33.7s-12.22,1.59-25.48,6.25l-21.86-63.69s-42.48,12.95-69.62,33.75l20.52,26.93s-56.46,36.02-68.97,68.97l27.68,18.62s30.42-45.85,80.83-71.83Z"
                    />
                    <path
                        id="_4-2"
                        data-name="4"
                        className={'sector ' + cyborgs[4]}
                        d="M267.89,214.32l21.86,25.45s-39.66,30.71-49.71,71.59l38.99,8.12s33.78-70.2,100.89-79.71l-7.53-38.46s-25.59.05-45.25,13.01l-17.59-27.72s-27.61,13.68-41.65,27.72Z"
                    />

                    <path
                        id="_3-2"
                        data-name="3"
                        className={'sector ' + cyborgs[3]}
                        d="M267.89,351.8l73.33,11.57s-2.3,17.6,3.67,30.17l-138.76,48.77s-50.33-130.22,61.76-227.99l21.86,25.45s-39.87,32.47-49.71,71.59l38.99,8.12s-7.67,14.2-11.14,32.31Z"
                    />
                    <path
                        id="_2-2"
                        data-name="2"
                        className={'sector ' + cyborgs[2]}
                        d="M386.38,276.32l-6.46-36.55s-81.1,4.54-112.03,112.03l73.33,11.57s3.01-23.29,21.33-36.51l-21.33-29.82s21.35-19.45,45.16-20.72Z"
                    />
                    <path
                        id="_1-2"
                        data-name="1"
                        className={'sector ' + cyborgs[1]}
                        d="M403.54,373.37l-58.65,20.16s-15.64-41.09,17.65-66.68l-21.33-29.82s23.64-19.33,45.16-20.72l17.17,97.05Z"
                    />
                </g>

                <g id="illuminate">
                    <path
                        id="_11"
                        data-name="11"
                        className={'sector ' + illuminate[11]}
                        d="M298.19,763.58h207.72s-103.86,5.72-103.86,68.03c0,0,2.56-68.03-103.86-68.03Z"
                    />
                    <path
                        id="_10"
                        data-name="10"
                        className={'sector ' + illuminate[10]}
                        d="M303.41,700.52s87.13,30.02,204.43-1.95l11.34,29.93s-99.63,40.89-224.92,0l9.16-27.99Z"
                    />
                    <path
                        id="_9"
                        data-name="9"
                        className={'sector ' + illuminate[9]}
                        d="M532.14,653.64s78.72-34.71,106.23-80.88l51.36,40.44s-68.66,86.13-170.55,115.31l-11.34-29.93,38.8-14.44-14.49-30.49Z"
                    />
                    <path
                        id="_8"
                        data-name="8"
                        className={'sector ' + illuminate[8]}
                        d="M326.38,638.81s86.86,23.97,128.52,3.26l6.52,31.91s52.07-4.49,70.72-20.34l14.49,30.49s-115.86,56.65-243.22,16.39l22.97-61.71Z"
                    />
                    <path
                        id="_7"
                        data-name="7"
                        className={'sector ' + illuminate[7]}
                        d="M283.8,622.51s20.24,10.59,39.81,16.3l-29.36,89.7s-120.25-33.53-178.36-117.06l51.97-40.32s42.01,56.9,98.88,78.6"
                    />

                    <path
                        id="_6"
                        data-name="6"
                        className={'sector ' + illuminate[6]}
                        d="M548.67,520.57l47.77,47.77s8.88-5.1,18.28-16.78l23.65,21.2s-61.97,86.64-176.95,101.22l-6.52-31.91s35.88-3.26,57.08-17.12l-26.09-61.16s36.5-15.71,62.79-43.22Z"
                    />
                    <path
                        id="_5"
                        data-name="5"
                        className={'sector ' + illuminate[5]}
                        d="M337.95,536.15s40.25,15.44,76.27,10.59l3.98,69.19s51.37-7.3,79.1-22.8l14.68,31.8s-107.64,57.9-226.69-4.08l52.67-84.72Z"
                    />
                    <path
                        id="_4"
                        data-name="4"
                        className={'sector ' + illuminate[4]}
                        d="M270.62,486.94l-51.19,42.6s11.71,19.48,25.6,27.44l-42.98,49.73s28.28,31.14,64.69,43.02l71.21-113.57s-51.39-21.46-67.32-49.21Z"
                    />
                    <path
                        id="_3"
                        data-name="3"
                        className={'sector ' + illuminate[3]}
                        d="M479.16,436.56l59.04,48.32-12.2,12.2,22.67,22.67s-8.97,22.02-63.6,45.66l12.23,28.54s-26.91,17.87-77.47,21.98l-5.61-69.19,36.03-4.85-10.09-37.87,36.94-16.65-21.64-28.84,23.7-21.97Z"
                    />
                    <path
                        id="_2"
                        data-name="2"
                        className={'sector ' + illuminate[2]}
                        d="M450.25,413.6s-11.88,18.83-37.12,20.29l11.33,35.84s-47.94,10.58-84.62-21.18l-50.09,57.55s56.97,58.16,160.5,35.79l-10.09-37.87s19.76-3.13,36.94-16.65l-21.64-28.84s14.71-9.34,23.7-21.97l-28.91-22.96Z"
                    />
                    <path
                        id="_1"
                        data-name="1"
                        className={'sector ' + illuminate[1]}
                        d="M402.05,373.44l48.2,40.16s-13.99,18.01-37.12,20.29l11.33,35.84s-58.83,10.78-96.1-32.65l73.68-63.63Z"
                    />
                </g>

                <g id="superearth">
                    <circle
                        id="_0"
                        data-name="0"
                        className="cls-2"
                        cx="402.08"
                        cy="374.21"
                        r="38.07"
                    />
                </g>
            </svg>
            <Script src="/scripts/animateMap.js" strategy="lazyOnload" />
        </section>
    );
}
