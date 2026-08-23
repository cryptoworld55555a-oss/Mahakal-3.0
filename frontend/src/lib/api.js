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
export const activateId = (payload) =>
  api.post("/activate", payload).then((r) => r.data);
export const getMe = (address) => api.get(`/me/${address}`).then((r) => r.data);
export const getHolders = (params) =>
  api.get("/holders", { params }).then((r) => r.data);
export const getTeam = (address) => api.get(`/team/${address}`).then((r) => r.data);

// ---- Admin panel ----
export const adminOverview = () => api.get("/admin/overview").then((r) => r.data);
export const adminUsers = (params) => api.get("/admin/users", { params }).then((r) => r.data);
export const adminUserDetail = (address) => api.get(`/admin/user/${address}`).then((r) => r.data);
export const getRewardUser = (address) => api.get(`/reward/tree/user/${address}`).then((r) => r.data);
export const buildRewardTree = () => api.post("/reward/tree/build").then((r) => r.data);
export const seedDemoNetwork = () => api.post("/reward/tree/seed-demo").then((r) => r.data);

export default api;
