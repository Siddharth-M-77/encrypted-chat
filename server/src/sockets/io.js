// Holds the Socket.IO server instance so services can emit without importing the socket handlers (avoids import cycles).
let io = null;
export const setIo = (instance) => { io = instance; };
export const getIo = () => io;
