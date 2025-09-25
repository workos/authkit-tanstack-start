import { createFileRoute } from '@tanstack/react-router';
import { handleCallbackRoute } from '@workos/authkit-tanstack-start/server';

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: handleCallbackRoute,
    },
  },
});
