// Shared timing for runtime sessions (delivery + heartbeat routes).

// How often a running script must check in.
export const HEARTBEAT_INTERVAL_SECONDS = 45;

// How long a session survives without a beat before it is treated as dead.
export const HEARTBEAT_TTL_SECONDS = HEARTBEAT_INTERVAL_SECONDS * 4;
