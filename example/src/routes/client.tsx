import { createFileRoute } from '@tanstack/react-router';
import { Badge, Box, Button, Code, Flex, Heading, Text, TextField, Callout } from '@radix-ui/themes';
import { useAuth, useAccessToken } from '@workos/authkit-tanstack-start/client';

export const Route = createFileRoute('/client')({
  component: RouteComponent,
});

function RouteComponent() {
  const {
    user,
    loading,
    sessionId,
    organizationId,
    role,
    roles,
    permissions,
    entitlements,
    featureFlags,
    impersonator,
    signOut,
  } = useAuth();
  const { accessToken, loading: tokenLoading, error: tokenError, refresh, getAccessToken } = useAccessToken();

  const handleRefreshToken = async () => {
    try {
      await refresh();
    } catch (err) {
      console.error('Token refresh failed:', err);
    }
  };

  const handleGetFreshToken = async () => {
    try {
      const token = await getAccessToken();
      console.log('Fresh token:', token);
    } catch (err) {
      console.error('Get fresh token failed:', err);
    }
  };

  if (loading) {
    return (
      <Flex direction="column" gap="2" align="center">
        <Heading size="8">Loading...</Heading>
      </Flex>
    );
  }

  if (!user) {
    return (
      <Flex direction="column" gap="4" align="center" maxWidth="600px">
        <Heading size="8" align="center">
          Client-Side Hooks Demo
        </Heading>
        <Text size="5" align="center" color="gray">
          This page demonstrates the client-side hooks from <Code>@workos/authkit-tanstack-start/client</Code>
        </Text>
        <Callout.Root>
          <Callout.Text>ℹ️ Please sign in to see the client-side hooks in action.</Callout.Text>
        </Callout.Root>
      </Flex>
    );
  }

  return (
    <Flex direction="column" gap="5" maxWidth="800px">
      <Flex direction="column" gap="2" mb="2">
        <Heading size="8" align="center">
          Client-Side Hooks Demo
        </Heading>
        <Text size="5" align="center" color="gray">
          Using <Code>useAuth()</Code> and <Code>useAccessToken()</Code>
        </Text>
      </Flex>

      <Callout.Root>
        <Callout.Text>
          ℹ️ This page uses client-side React hooks to access authentication data. Unlike server-side loaders, these
          hooks work in client components and automatically update when auth state changes.
        </Callout.Text>
      </Callout.Root>

      <Flex direction="column" gap="3">
        <Heading size="5">useAuth() Hook</Heading>
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              User ID:
            </Text>
            <TextField.Root value={user.id} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Email:
            </Text>
            <TextField.Root value={user.email} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              First Name:
            </Text>
            <TextField.Root value={user.firstName || ''} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Last Name:
            </Text>
            <TextField.Root value={user.lastName || ''} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Session ID:
            </Text>
            <TextField.Root value={sessionId || ''} readOnly style={{ flexGrow: 1 }} />
          </Flex>
          {organizationId && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Organization ID:
              </Text>
              <TextField.Root value={organizationId} readOnly style={{ flexGrow: 1 }} />
            </Flex>
          )}
          {role && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Role:
              </Text>
              <TextField.Root value={role} readOnly style={{ flexGrow: 1 }} />
            </Flex>
          )}
          {roles && roles.length > 0 && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Roles:
              </Text>
              <Flex gap="2" wrap="wrap" style={{ flexGrow: 1 }}>
                {roles.map((r) => (
                  <Badge key={r}>{r}</Badge>
                ))}
              </Flex>
            </Flex>
          )}
          {permissions && permissions.length > 0 && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Permissions:
              </Text>
              <Flex gap="2" wrap="wrap" style={{ flexGrow: 1 }}>
                {permissions.map((p) => (
                  <Badge key={p} color="blue">
                    {p}
                  </Badge>
                ))}
              </Flex>
            </Flex>
          )}
          {entitlements && entitlements.length > 0 && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Entitlements:
              </Text>
              <Flex gap="2" wrap="wrap" style={{ flexGrow: 1 }}>
                {entitlements.map((e) => (
                  <Badge key={e} color="green">
                    {e}
                  </Badge>
                ))}
              </Flex>
            </Flex>
          )}
          {featureFlags && featureFlags.length > 0 && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Feature Flags:
              </Text>
              <Flex gap="2" wrap="wrap" style={{ flexGrow: 1 }}>
                {featureFlags.map((f) => (
                  <Badge key={f} color="purple">
                    {f}
                  </Badge>
                ))}
              </Flex>
            </Flex>
          )}
          {impersonator && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Impersonator:
              </Text>
              <TextField.Root value={impersonator.email} readOnly style={{ flexGrow: 1 }} />
            </Flex>
          )}
        </Flex>
      </Flex>

      <Flex direction="column" gap="3">
        <Heading size="5">useAccessToken() Hook</Heading>
        <Flex direction="column" gap="2">
          <Flex align="center" gap="2">
            <Text weight="bold" style={{ width: 150 }}>
              Token Status:
            </Text>
            <Badge color={tokenLoading ? 'yellow' : accessToken ? 'green' : 'gray'}>
              {tokenLoading ? 'Loading' : accessToken ? 'Available' : 'None'}
            </Badge>
          </Flex>
          {tokenError && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Error:
              </Text>
              <Badge color="red">{tokenError.message}</Badge>
            </Flex>
          )}
          {accessToken && (
            <Flex align="center" gap="2">
              <Text weight="bold" style={{ width: 150 }}>
                Access Token:
              </Text>
              <Box style={{ flexGrow: 1, maxWidth: '100%', overflow: 'hidden' }}>
                <Code size="2" style={{ wordBreak: 'break-all', display: 'block' }}>
                  ...{accessToken.slice(-20)}
                </Code>
              </Box>
            </Flex>
          )}
          <Flex gap="2" mt="2">
            <Button onClick={handleRefreshToken} disabled={tokenLoading}>
              Refresh Token
            </Button>
            <Button onClick={handleGetFreshToken} disabled={tokenLoading} variant="soft">
              Get Fresh Token (Console)
            </Button>
          </Flex>
        </Flex>
      </Flex>

      <Flex justify="center" mt="4">
        <Button onClick={() => signOut({ returnTo: '/' })} color="red" variant="soft">
          Sign Out
        </Button>
      </Flex>
    </Flex>
  );
}
