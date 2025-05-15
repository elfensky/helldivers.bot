import { auth } from '@/auth';
import { getPosts, createRandomPost } from '@/db/queries/post';

export default async function PostPage() {
    const session = await auth();
    const loggedIn = session && session.user ? true : false;
    // const posts =

    return (
        <div className="">
            <h1>Posts</h1>
            {loggedIn ?
                <PostEditor />
            :   null}
            {loggedIn ?
                <GeneratePost />
            :   null}
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
        <ul className="flex flex-col flex-wrap gap-2">
            {posts.map((post) => (
                <li key={post.id} className="bg-gray-600">
                    <article>
                        <h2>{post.title}</h2>
                        <p>{post.content}</p>
                    </article>
                </li>
            ))}
        </ul>
    );
}

function PostEditor() {
    return (
        <form action="" className="bg-pink-500">
            <input type="text" name="title" placeholder="Title" />
            <textarea name="content" placeholder="Content"></textarea>
            <button type="submit">Submit</button>
        </form>
    );
}

async function GeneratePost() {
    // const handleGeneratePost = async (e) => {
    //     'use server';
    //     e.preventDefault();
    //     const result = await createRandomPost();
    //     console.log(result);
    // };

    return (
        <button onClick={createRandomPost} className="bg-yellow-300" type="submit">
            Generate Post
        </button>
    );
}
