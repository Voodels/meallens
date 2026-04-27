import React,{createContext,useContext,useState} from "react";
import api from "./api";

const AuthContext = createContext(null);
export const AuthProvider = ({children})=>{
    const [token,setToken] = useState(localStorage.getItem('token'));
    const login = async (email,password)=>{
        const response = await api.post('/auth/login',{email,password});
        //
        const jwt = response.data;
        localStorage.setItem('token',jwt);
        setToken(jwt);
    };
    const register = async (name,email,password)=>{
        await api.post('/auth/register',{name,email,password});
        await login(email,password);
    };
    const logout = ()=>{
        localStorage.removeItem('token');
        setToken(null);
    }

    return(
        <AuthContext.Provider value={{
            token,isAuthenticated:!!token,
            login,
            register,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = ()=>{
    return useContext(AuthContext);
};
