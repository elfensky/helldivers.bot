import { auth } from '@/auth';
//next
import Image from 'next/image';
//db
import { updateUser } from '@/db/queries/user';
//utils
import { getGravatarUrl } from '@/utils/gravatar';

export default async function AccountSettings() {
    const session = await auth();

    const user = session.user;

    return (
        <div className="flex flex-col gap-2">
            <h1 className="text-4xl">Dashboard</h1>
            {/* <p>list of account data</p> */}

            <ul>
                <li>
                    {/* <Email user={user} /> */}
                    <Avatar user={user} />
                </li>
            </ul>

            {/* <ul>
                <li>{user.id}</li>
                <li>{user.name}</li>
                <li>{user.username}</li>
                <li>{user.email}</li>
                <li>{user.emailVerified}</li>
                <li>{user.image}</li>
                <li>{user.role}</li>
                <li>{user.createdAt}</li>
                <li>{user.updatedAt}</li>
            </ul> */}
        </div>
    );
}

function Email({ user }) {
    // console.log(user);
    // if (user.emailVerified) {
    // }

    return (
        <>
            <form action="" className="flex flex-row gap-2">
                <label htmlFor="email">Email</label>

                <input
                    type="email"
                    name="email"
                    id="email"
                    placeholder={user.email}
                    aria-label="Enter your email address to update it"
                    aria-required="false"
                />

                <button type="submit" aria-label="Update email address">
                    Update
                </button>
            </form>
            {user.emailVerified ?
                <span className="text-green-400">
                    Email was verified on {user.emailVerified}
                </span>
            :   <div className="flex flex-row gap-2">
                    <span className="text-red-400">Not Verified</span>
                    <form action="">
                        <button type="submit" aria-label="Verify email address">
                            Verify
                        </button>
                    </form>
                </div>
            }
        </>
    );
}

function Avatar({ user }) {
    let avatarUrl = '';
    if (user.image === null) {
        avatarUrl = getGravatarUrl(user.email);
    } else {
        avatarUrl = user.image;
    }

    const submitData = async (e) => {
        'use server';
        // e.preventDefault();
        console.log('updateUser', e);
        console.log(user);
        console.log(getGravatarUrl(user.email));
        // const user = await updateUserData(e);
    };

    return (
        <form action={submitData} className="flex flex-row gap-2">
            <Image
                src={avatarUrl}
                className="rounded-full"
                alt="User Avatar"
                width={200}
                height={200}
            />
            <span>{avatarUrl}</span>
            <button type="submit">Update</button>
        </form>
    );
}
