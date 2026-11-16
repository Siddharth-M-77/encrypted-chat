import { Outlet } from 'react-router-dom';
import { useChatSocket } from '../hooks/useChatSocket.js';
import { useCallSignaling } from '../hooks/useCallSignaling.js';
import ConnectionBanner from './ConnectionBanner.jsx';
import CallUI from './call/CallUI.jsx';

// Lives for the whole signed-in session, so the socket stays connected (and calls keep working)
// while navigating between the chat and settings pages.
export default function AppShell() {
  useChatSocket(); // creates the socket: keep before useCallSignaling
  useCallSignaling();
  return (
    <>
      <Outlet />
      <CallUI />
      <ConnectionBanner />
    </>
  );
}
