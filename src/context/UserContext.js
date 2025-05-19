import { createContext, useContext, useState } from 'react';
//related
import auth from '@/auth';
// 1. Create the context
const UserContext = createContext();

// 2. Create a provider component
export function UserProvider({ children }) {
    const session = auth();
    // You can initialize with default values or fetch from somewhere
    const [user, setUser] = useState({
        username: session?.user?.username,
        avatar: session?.user?.image,
    });

    const [api, setApi] = useState([]);

    return (
        <UserContext.Provider value={{ user, setUser, api, setApi }}>
            {children}
        </UserContext.Provider>
    );
}

// 3. Custom hook for easy usage
export function useUser() {
    return useContext(UserContext);
}
