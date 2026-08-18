import axios from "axios";
import { config } from "@/config";

const api = axios.create({ baseURL: config.apiUrl, timeout: 20000 });

export const getConfig = () => api.get("/config").then((r) => r.data);
export const getDashboardStats = () => api.get("/dashboard/stats").then((r) => r.data);
export const getNonce = (address) =>
  api.get("/auth/nonce", { params: { address } }).then((r) => r.data);
export const verifySignature = (payload) =>
  api.post("/auth/verify", payload).then((r) => r.data);
export const getUser = (address) => api.get(`/user/${address}`).then((r) => r.data);

export default api;
