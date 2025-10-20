import { createFileRoute } from '@tanstack/react-router';
import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start';

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: handleCallbackRoute({
        onSuccess: async ({ user, authenticationMethod }) => {
          console.log('Authentication successful:', user.email, authenticationMethod);
        },
        onError: ({ error }) => {
          console.error('Authentication failed:', error);
          return new Response(
            JSON.stringify({
              error: {
                message: 'Authentication failed',
                description: 'Something went wrong during sign in. Please try again.',
              },
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        },
      }),
    },
  },
});
