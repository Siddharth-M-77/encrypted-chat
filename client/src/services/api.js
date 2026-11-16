import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import toast from 'react-hot-toast';

const rawBaseQuery = fetchBaseQuery({ baseUrl: '/api', credentials: 'include' });
const AUTH_ENDPOINTS = new Set(['me', 'verify', 'getNonce', 'logout']);

// A 401 anywhere else means the session expired (or was revoked): drop to the signed-out state once.
const baseQuery = async (args, apiCtx, extra) => {
  const result = await rawBaseQuery(args, apiCtx, extra);
  if (result.error?.status === 401 && !AUTH_ENDPOINTS.has(apiCtx.endpoint)) {
    apiCtx.dispatch({ type: 'auth/sessionExpired' });
  }
  if (result.error?.status === 'FETCH_ERROR') result.error.message = 'Network error. Check your connection.';
  return result;
};

export const notifySessionExpired = () => toast.error('Your session expired. Please sign in again.', { id: 'session-expired' });

// All requests go to /api (proxied to the backend in dev, same origin behind Nginx in prod).
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Me', 'User', 'Blocked'],
  endpoints: (b) => ({
    // Nonces are single-use, so this is a mutation to bypass RTK Query caching.
    getNonce: b.mutation({ query: (address) => ({ url: '/auth/nonce', params: { address } }) }),
    verify: b.mutation({ query: (body) => ({ url: '/auth/verify', method: 'POST', body }) }),
    me: b.query({ query: () => '/auth/me', providesTags: ['Me'] }),
    logout: b.mutation({ query: () => ({ url: '/auth/logout', method: 'POST' }) }),
    updateProfile: b.mutation({ query: (body) => ({ url: '/users/me', method: 'PATCH', body }) }),
    // Key backup is fetched on demand and never cached.
    getKeys: b.query({ query: () => '/users/me/keys', keepUnusedDataFor: 0 }),
    putKeys: b.mutation({ query: (body) => ({ url: '/users/me/keys', method: 'PUT', body }) }),
    getConversations: b.query({
      query: ({ page = 1, limit = 30 } = {}) => ({ url: '/conversations', params: { page, limit } }),
      keepUnusedDataFor: 0,
    }),
    createDirect: b.mutation({ query: (userId) => ({ url: '/conversations/direct', method: 'POST', body: { userId } }) }),
    getMessages: b.query({
      query: ({ id, before, limit = 30 }) => ({ url: `/conversations/${id}/messages`, params: { before, limit } }),
      keepUnusedDataFor: 0,
    }),
    createGroup: b.mutation({ query: (body) => ({ url: '/conversations/group', method: 'POST', body }) }),
    updateConversation: b.mutation({ query: ({ id, ...body }) => ({ url: `/conversations/${id}`, method: 'PATCH', body }) }),
    addMembers: b.mutation({ query: ({ id, ...body }) => ({ url: `/conversations/${id}/members`, method: 'POST', body }) }),
    removeMember: b.mutation({ query: ({ id, userId, ...body }) => ({ url: `/conversations/${id}/members/${userId}`, method: 'DELETE', body }) }),
    leaveGroup: b.mutation({ query: (id) => ({ url: `/conversations/${id}/leave`, method: 'POST' }) }),
    rotateGroupKey: b.mutation({ query: ({ id, ...body }) => ({ url: `/conversations/${id}/keys/rotate`, method: 'POST', body }) }),
    getGroupKeys: b.query({ query: (id) => `/conversations/${id}/keys`, keepUnusedDataFor: 0 }),
    getAllGroupKeys: b.query({ query: () => '/conversations/group-keys', keepUnusedDataFor: 0 }),
    getIceServers: b.query({ query: () => '/calls/ice-servers', keepUnusedDataFor: 0 }),
    deleteMessage: b.mutation({
      query: ({ id, scope, fileId }) => ({ url: `/messages/${id}`, method: 'DELETE', params: { scope, fileId } }),
    }),
    blockUser: b.mutation({ query: (id) => ({ url: `/users/${id}/block`, method: 'POST' }), invalidatesTags: ['Blocked'] }),
    unblockUser: b.mutation({ query: (id) => ({ url: `/users/${id}/block`, method: 'DELETE' }), invalidatesTags: ['Blocked'] }),
    getBlocked: b.query({ query: () => '/users/me/blocked', providesTags: ['Blocked'] }),
    searchUsers: b.query({ query: (q) => ({ url: '/users/search', params: { q } }) }),
    getUser: b.query({ query: (id) => `/users/${id}`, providesTags: (_r, _e, id) => [{ type: 'User', id }] }),
  }),
});

export const {
  useGetNonceMutation, useVerifyMutation, useMeQuery, useLogoutMutation,
  useUpdateProfileMutation, usePutKeysMutation, useBlockUserMutation, useUnblockUserMutation, useGetBlockedQuery, useCreateDirectMutation, useSearchUsersQuery, useGetUserQuery,
} = api;

// Extract a human-readable message from an RTK Query error or a thrown Error.
export function errorMessage(err, fallback = 'Something went wrong') {
  return err?.data?.message || err?.message || err?.error || fallback;
}
