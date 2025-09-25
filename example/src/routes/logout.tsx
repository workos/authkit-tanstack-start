import { createFileRoute } from '@tanstack/react-router';
import { signOut } from '@workos/authkit-tanstack-start/server';

export const Route = createFileRoute('/logout')({
  preload: false,
  loader: async () => {
    await signOut();
  },
});
