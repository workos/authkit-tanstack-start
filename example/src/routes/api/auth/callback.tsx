import { createFileRoute } from '@tanstack/react-router';
import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start';

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: handleCallbackRoute(),
      // Example with onSuccess hook:
      // GET: handleCallbackRoute({
      //   onSuccess: async ({ user, authenticationMethod }) => {
      //     // Create user record in your database
      //     console.log('User authenticated:', user.email, 'via', authenticationMethod);
      //   },
      //   onError: ({ error }) => {
      //     // Custom error handling
      //     console.error('Authentication failed:', error);
      //     return new Response('Custom error page', { status: 500 });
      //   },
      // }),
    },
  },
});
