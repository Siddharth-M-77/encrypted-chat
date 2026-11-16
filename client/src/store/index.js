import { configureStore } from '@reduxjs/toolkit';
import { api } from '../services/api.js';
import auth from './authSlice.js';
import keys from './keysSlice.js';
import chat from './chatSlice.js';
import call from './callSlice.js';

export const store = configureStore({
  reducer: { [api.reducerPath]: api.reducer, auth, keys, chat, call },
  middleware: (gdm) => gdm().concat(api.middleware),
});
