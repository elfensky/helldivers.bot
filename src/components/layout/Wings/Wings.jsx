import './Wings.css';
import Image from 'next/image';

export default function Wings({ as = 'h2', wings = false, children }) {
    const Heading = as;

    return (
        <span className="flex w-full flex-col items-center bg-purple-400">
            {/* <span className="flex w-full flex-row bg-green-400"> */}
            {/* <Image src="/icons/wings.webp" width="90" height="30" /> */}
            {/* {wrapFirstChunk(children.toString(), 20, wings)} */}
            {children}
            {/* <Image src="/icons/wings.webp" width="90" height="30" /> */}
            {/* </span> */}
        </span>
    );
}

// function wrapFirstChunk(str, maxLen, wings) {
//     const words = str.split(' ');
//     let chunk = '';
//     let i = 0;

//     // Build the first chunk without exceeding maxLen
//     while (i < words.length) {
//         const testChunk = chunk ? chunk + ' ' + words[i] : words[i];
//         if (testChunk.length > maxLen) break;
//         chunk = testChunk;
//         i++;
//     }

//     // The rest of the string
//     const rest = words.slice(i).join(' ');

//     // Return the HTML string
//     return (
//         <>
//             <span data-wings={wings} className="title-chunk flex flex-row">
//                 {chunk}
//             </span>
//             <span className="title-rest">{rest ? ' ' + rest : ''}</span>
//         </>
//     );
// }
