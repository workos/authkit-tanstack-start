import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

console.log('ROUTER', process.env.WORKOS_API_KEY);

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  });

  return router;
}
