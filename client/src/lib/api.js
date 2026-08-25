import axios from 'axios';

/**
 * Two clients on purpose:
 *   `api`     — everything, carries the in-memory access token, auto-refreshes on 401
 *   `rawApi`  — auth endpoints themselves, so refreshing can never recurse
 * Both go through the Vite proxy, keeping the refresh cookie same-origin.
 */
export const api = axios.create({ baseURL: '/api', withCredentials: true });
export const rawApi = axios.create({ baseURL: '/api', withCredentials: true });

let accessToken = null;
let onAuthLost = () => {};
let refreshInFlight = null;

export const setAccessToken = (token) => { accessToken = token; };
export const getAccessToken = () => accessToken;
export const setOnAuthLost = (fn) => { onAuthLost = fn; };

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

/** POST /auth/refresh, but only ever one at a time — concurrent 401s share it. */
export function refreshSession() {
  refreshInFlight ??= rawApi
    .post('/auth/refresh')
    .then((res) => {
      setAccessToken(res.data.accessToken);
      return res.data;
    })
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        onAuthLost();
      }
    }
    return Promise.reject(error);
  }
);

/** Pulls the readable message out of our `{ error: { message } }` envelope. */
export function errorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.error?.message ?? error?.message ?? fallback;
}

/** Field-level validation errors from zod, if the server sent any. */
export const fieldErrors = (error) => error?.response?.data?.error?.details ?? null;
