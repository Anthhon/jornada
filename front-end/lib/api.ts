import axios from "axios";
import { User } from "@/types/user";

const API_BASE = "http://127.0.0.1:8000/api"

export const api = axios.create({
    baseURL: API_BASE,
});

export const getUsers = () => api.get<User[]>("/users/");
