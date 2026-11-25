import type { Env } from './env';
import type { Actor } from './lib/access';

// Hono typing: bindings from the environment, and values set by middleware for each request.
export type AppEnv = {
  Bindings: Env;
  Variables: {
    userId: number; // the workspace the request works on (the owner's id for team members)
    actor: Actor; // who is signed in
  };
};
