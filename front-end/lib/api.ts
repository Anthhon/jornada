import axios from "axios";
import { User } from "@/types/user";

const API_BASE = "http://127.0.0.1:8000/api"

export const api = axios.create({ baseURL: API_BASE });

export const getUsers = () => api.get<User[]>("/users/");
export const login = (username: string, password: string) => axios.post(`${API_BASE}/token/`, { username, password });

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

