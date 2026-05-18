# TanStack Start + WorkOS

This site is built with TanStack Router. It demonstrates authenticating users with AuthKit and the npm-published `@workos/authkit-tanstack-react-start` SDK.

- [TanStack Router Docs](https://tanstack.com/router)

## Prerequisites

You will need a [WorkOS account](https://dashboard.workos.com/signup).

## Running the example

1. In the [WorkOS dashboard](https://dashboard.workos.com), click on the User Management tile and set up the [sign-in callback redirect](https://workos.com/docs/user-management/1-configure-your-project/configure-a-redirect-uri) as `http://localhost:3000/api/auth/callback`. Once completed, set the app homepage URL to `http://localhost:3000`.

   > [!NOTE]
   > If you already have set up an application in your WorkOS dashboard, then you can simply head to the _Redirects_ tab and add a new redirect URI.

2. After creating the redirect URI, navigate to the API keys tab and copy the _Client ID_ and the _Secret Key_. Rename the `.env.example` file to `.env` and supply your Client ID and API key as environment variables.

3. Additionally, create a cookie password as the private key used to encrypt the session cookie. Copy the output into the environment variable `WORKOS_COOKIE_PASSWORD`.

   It has to be at least 32 characters long. You can use https://1password.com/password-generator/ to generate strong passwords.

4. Verify your `.env` file has the following variables filled.

   ```bash
   WORKOS_CLIENT_ID=<YOUR_CLIENT_ID>
   WORKOS_API_KEY=<YOUR_API_SECRET_KEY>
   WORKOS_COOKIE_PASSWORD=<YOUR_COOKIE_PASSWORD>
   WORKOS_REDIRECT_URI=http://localhost:3000/api/auth/callback
   ```

   `WORKOS_COOKIE_PASSWORD` is the private key used to encrypt the session cookie. It has to be at least 32 characters long. You can use the [1Password generator](https://1password.com/password-generator/) or the `openssl` library to generate a strong password via the command line:

   ```bash
   openssl rand -base64 24
   ```

   To use the `signOut` method, you'll need to set a default Logout URI in your WorkOS dashboard settings under "Redirects".

5. Run the following command and navigate to [http://localhost:3000](http://localhost:3000).

   ```bash
   pnpm dev
   ```

## Deploying to Cloudflare Workers

This example is configured for Cloudflare Workers using the Cloudflare Vite plugin. Local development keeps the workspace dependency, while `pnpm run deploy` stages a temporary copy that rewrites `@workos/authkit-tanstack-react-start` to the published npm version matching this repo's package version. Override it with `WORKOS_AUTHKIT_TANSTACK_START_VERSION` when you need a different published version.

1. Create a Worker from this `example/` directory, or deploy locally:

   ```bash
   pnpm run deploy
   ```

2. Add these Worker variables/secrets in Cloudflare:

   ```bash
   WORKOS_CLIENT_ID=<YOUR_CLIENT_ID>
   WORKOS_API_KEY=<YOUR_API_SECRET_KEY>
   WORKOS_COOKIE_PASSWORD=<YOUR_COOKIE_PASSWORD>
   WORKOS_REDIRECT_URI=https://<YOUR_WORKER_HOST>/api/auth/callback
   ```

3. In the WorkOS dashboard Redirects settings, add the deployed callback URI and set the sign-in endpoint to:

   ```text
   https://<YOUR_WORKER_HOST>/api/auth/sign-in
   ```
