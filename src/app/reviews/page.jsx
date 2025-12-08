import { auth } from '@/auth';
import { getPosts, createRandomPost, createPost } from '@/db/queries/post';
import { formatDate, timeSince } from '@/utils/time';
import Image from 'next/image';

export default async function PostPage() {
    const session = await auth();
    const loggedIn = session && session.user ? true : false;
    // const posts =

    return (
        <div className="">
            <h1>Posts</h1>
            {loggedIn ?
                <PostEditor />
                : null}
            {/* {loggedIn ?
                <GeneratePost />
            :   null} */}
            <ShowPosts />
        </div>
    );
}

async function ShowPosts() {
    const result = await getPosts();

    if (result.error) {
        return (
            <ul>
                <li>Error: {result.error}</li>
            </ul>
        );
    }

    if (result.data.length < 1) {
        return (
            <ul>
                <li>No posts yet</li>
            </ul>
        );
    }

    const posts = result.data;

    return (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
            {posts.map((post) => (
                <li key={post.id} className="bg-gray-600">
                    <figure>
                        <blockquote>
                            <h4>{post.title}</h4>
                            <p>{post.content}</p>
                        </blockquote>
                        <figcaption className="flex flex-col justify-between">
                            <div className="flex flex-row gap-2">
                                —
                                <PostAuthor author={post.author} />
                                {post.author.image ?
                                    <Image
                                        src={post.author.image}
                                        alt="Author"
                                        width={25}
                                        height={25}
                                        className="rounded-full"
                                        priority={true}
                                    />
                                    : null}
                            </div>
                            {timeSince(post.updatedAt)}
                            {/* {formatDate(post.updatedAt)} */}
                            {/* <cite>actual source</cite> */}
                        </figcaption>
                    </figure>
                </li>
            ))}
        </ul>
    );
}

function PostEditor() {
    return (
        <form action={createPost} className="flex flex-col items-start bg-pink-500">
            <input type="text" name="title" placeholder="Title" required />
            <textarea name="content" placeholder="Content" required></textarea>
            <button type="submit" className="bg-amber-700">
                Submit
            </button>
        </form>
    );
}

async function GeneratePost() {
    return (
        <button onClick={createRandomPost} className="bg-yellow-300" type="submit">
            Generate Post
        </button>
    );
}

function PostAuthor({ author }) {
    // console.log('PostAuthor', author);
    if (author.name) {
        return <span>{author.name}</span>;
    }
    if (author.username) {
        return <span>{author.username}</span>;
    }
    if (author.email) {
        //trim email
        return <span>{trimEmailV2(author.email)}</span>;
    }
    return <span>Anonymous</span>;
}

function trimEmailV1(email) {
    const [user, domain] = email.split('@');
    if (!user || !domain) return email; // fallback for invalid email
    return `${user[0]}***@${domain}`;
}

function trimEmailV2(email) {
    const [user, domain] = email.split('@');
    return user;
}
