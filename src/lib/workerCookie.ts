/**
 * The cookie the switcher's choice is kept in (`WorkerScope`).
 *
 * In a module of its own rather than beside the switcher, because the layout
 * that reads it is a server component: a constant exported from a `"use client"`
 * file reaches the server as a client reference and not as the string.
 */
export const WORKER_COOKIE = "worker";
