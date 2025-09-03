// D:/RECOVER_DATA/Programming/React_Node.js/CHAT-APP/frontend/src/lib\axios.js

import axios from "axios";

export const axiosInstance = axios.create({
    baseURL: "http://localhost:5001/api",
    withCredentials: true
})