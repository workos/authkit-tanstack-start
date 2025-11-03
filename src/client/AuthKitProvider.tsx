import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { checkSessionAction, getAuthAction, refreshAuthAction, switchToOrganizationAction } from '../server/actions.js';
import { ClientUserInfo, NoUserInfo, signOut } from '../server/server-functions.js';
import type { AuthContextType, AuthKitProviderProps } from './types.js';
import type { User, Impersonator } from '../types.js';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getProps = (auth: ClientUserInfo | NoUserInfo | undefined) => {
  return {
    user: auth && 'user' in auth ? auth.user : null,
    sessionId: auth && 'sessionId' in auth ? auth.sessionId : undefined,
    organizationId: auth && 'organizationId' in auth ? auth.organizationId : undefined,
    role: auth && 'role' in auth ? auth.role : undefined,
    roles: auth && 'roles' in auth ? auth.roles : undefined,
    permissions: auth && 'permissions' in auth ? auth.permissions : undefined,
    entitlements: auth && 'entitlements' in auth ? auth.entitlements : undefined,
    featureFlags: auth && 'featureFlags' in auth ? auth.featureFlags : undefined,
    impersonator: auth && 'impersonator' in auth ? auth.impersonator : undefined,
  };
};

export function AuthKitProvider({ children, onSessionExpired, initialAuth }: AuthKitProviderProps) {
  const navigate = useNavigate();
  const initialProps = getProps(initialAuth);
  const [user, setUser] = useState<User | null>(initialProps.user);
  const [sessionId, setSessionId] = useState<string | undefined>(initialProps.sessionId);
  const [organizationId, setOrganizationId] = useState<string | undefined>(initialProps.organizationId);
  const [role, setRole] = useState<string | undefined>(initialProps.role);
  const [roles, setRoles] = useState<string[] | undefined>(initialProps.roles);
  const [permissions, setPermissions] = useState<string[] | undefined>(initialProps.permissions);
  const [entitlements, setEntitlements] = useState<string[] | undefined>(initialProps.entitlements);
  const [featureFlags, setFeatureFlags] = useState<string[] | undefined>(initialProps.featureFlags);
  const [impersonator, setImpersonator] = useState<Impersonator | undefined>(initialProps.impersonator);
  const [loading, setLoading] = useState(initialAuth ? false : true);

  const getAuth = useCallback(async ({ ensureSignedIn = false }: { ensureSignedIn?: boolean } = {}) => {
    setLoading(true);
    try {
      const auth = await getAuthAction({ data: { ensureSignedIn } });
      const props = getProps(auth);
      setUser(props.user);
      setSessionId(props.sessionId);
      setOrganizationId(props.organizationId);
      setRole(props.role);
      setRoles(props.roles);
      setPermissions(props.permissions);
      setEntitlements(props.entitlements);
      setFeatureFlags(props.featureFlags);
      setImpersonator(props.impersonator);
    } catch (error) {
      setUser(null);
      setSessionId(undefined);
      setOrganizationId(undefined);
      setRole(undefined);
      setRoles(undefined);
      setPermissions(undefined);
      setEntitlements(undefined);
      setFeatureFlags(undefined);
      setImpersonator(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(
    async ({ ensureSignedIn = false, organizationId }: { ensureSignedIn?: boolean; organizationId?: string } = {}) => {
      try {
        setLoading(true);
        const auth = await refreshAuthAction({ data: { ensureSignedIn, organizationId } });
        const props = getProps(auth);
        setUser(props.user);
        setSessionId(props.sessionId);
        setOrganizationId(props.organizationId);
        setRole(props.role);
        setRoles(props.roles);
        setPermissions(props.permissions);
        setEntitlements(props.entitlements);
        setFeatureFlags(props.featureFlags);
        setImpersonator(props.impersonator);
      } catch (error) {
        return error instanceof Error ? { error: error.message } : { error: String(error) };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSignOut = useCallback(
    async ({ returnTo }: { returnTo?: string } = {}) => {
      try {
        await signOut({ data: { returnTo } });
      } catch (error) {
        // Server function throws redirect - extract URL and navigate appropriately
        if (error instanceof Response) {
          const location = error.headers.get('Location');
          if (location) {
            try {
              const url = new URL(location, window.location.origin);
              if (url.origin === window.location.origin) {
                // Internal routes use TanStack Router navigation with path only
                const path = url.pathname + url.search + url.hash;
                navigate({ to: path });
              } else {
                // External OAuth/logout URL requires full page navigation
                window.location.href = location;
              }
            } catch {
              // Invalid URL - use TanStack Router navigation as-is (for relative paths)
              navigate({ to: location });
            }
            return;
          }
        }
        throw error;
      }
    },
    [navigate],
  );

  const handleSwitchToOrganization = useCallback(async (organizationId: string) => {
    try {
      setLoading(true);
      const auth = await switchToOrganizationAction({ data: { organizationId } });

      if (!auth.user) {
        setUser(null);
        setSessionId(undefined);
        setOrganizationId(undefined);
        setRole(undefined);
        setRoles(undefined);
        setPermissions(undefined);
        setEntitlements(undefined);
        setFeatureFlags(undefined);
        setImpersonator(undefined);
        return;
      }

      setUser(auth.user);
      setSessionId(auth.sessionId);
      setOrganizationId(auth.organizationId);
      setRole(auth.role);
      setRoles(auth.roles);
      setPermissions(auth.permissions);
      setEntitlements(auth.entitlements);
      setFeatureFlags(auth.featureFlags);
      setImpersonator(auth.impersonator);
    } catch (error) {
      return error instanceof Error ? { error: error.message } : { error: String(error) };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getAuth();

    if (onSessionExpired === false) {
      return;
    }

    let visibilityChangedCalled = false;

    const handleVisibilityChange = async () => {
      if (visibilityChangedCalled) {
        return;
      }

      if (document.visibilityState === 'visible') {
        visibilityChangedCalled = true;

        try {
          const hasSession = await checkSessionAction();
          if (!hasSession) {
            throw new Error('Session expired');
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('Failed to fetch')) {
            if (onSessionExpired) {
              onSessionExpired();
            } else {
              window.location.reload();
            }
          }
        } finally {
          visibilityChangedCalled = false;
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [onSessionExpired, getAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionId,
        organizationId,
        role,
        roles,
        permissions,
        entitlements,
        featureFlags,
        impersonator,
        loading,
        getAuth,
        refreshAuth,
        signOut: handleSignOut,
        switchToOrganization: handleSwitchToOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(options: {
  ensureSignedIn: true;
}): AuthContextType & ({ loading: true; user: User | null } | { loading: false; user: User });
export function useAuth(options?: { ensureSignedIn?: false }): AuthContextType;
export function useAuth({ ensureSignedIn = false }: { ensureSignedIn?: boolean } = {}) {
  const context = useContext(AuthContext);

  useEffect(() => {
    if (context && ensureSignedIn && !context.user && !context.loading) {
      context.getAuth({ ensureSignedIn });
    }
  }, [ensureSignedIn, context?.user, context?.loading, context?.getAuth]);

  if (!context) {
    throw new Error('useAuth must be used within an AuthKitProvider');
  }

  return context;
}
