import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import { createWorkOSHandler } from '@workos/authkit-tanstack-start/server';

/**
 * Custom server entry point that wraps the default handler with WorkOS authentication
 */
const handler = createWorkOSHandler(defaultStreamHandler);

export default {
  fetch: createStartHandler(handler),
};