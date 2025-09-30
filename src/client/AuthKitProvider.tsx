import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { checkSessionAction, getAuthAction, refreshAuthAction } from '../server/actions.js';
import { signOut } from '../server/server-functions.js';
import type { AuthContextType, AuthKitProviderProps } from './types.js';
import type { User, Impersonator } from '@workos-inc/node';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthKitProvider({ children, onSessionExpired }: AuthKitProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [organizationId, setOrganizationId] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<string | undefined>(undefined);
  const [roles, setRoles] = useState<string[] | undefined>(undefined);
  const [permissions, setPermissions] = useState<string[] | undefined>(undefined);
  const [entitlements, setEntitlements] = useState<string[] | undefined>(undefined);
  const [featureFlags, setFeatureFlags] = useState<string[] | undefined>(undefined);
  const [impersonator, setImpersonator] = useState<Impersonator | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const getAuth = useCallback(async ({ ensureSignedIn = false }: { ensureSignedIn?: boolean } = {}) => {
    setLoading(true);
    try {
      const auth = await getAuthAction({ data: { ensureSignedIn } });
      setUser(auth.user);
      setSessionId(auth.user ? auth.sessionId : undefined);
      setOrganizationId('organizationId' in auth ? auth.organizationId : undefined);
      setRole('role' in auth ? auth.role : undefined);
      setRoles('roles' in auth ? auth.roles : undefined);
      setPermissions('permissions' in auth ? auth.permissions : undefined);
      setEntitlements('entitlements' in auth ? auth.entitlements : undefined);
      setFeatureFlags('featureFlags' in auth ? auth.featureFlags : undefined);
      setImpersonator('impersonator' in auth ? auth.impersonator : undefined);
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

        setUser(auth.user);
        setSessionId(auth.user ? auth.sessionId : undefined);
        setOrganizationId('organizationId' in auth ? auth.organizationId : undefined);
        setRole('role' in auth ? auth.role : undefined);
        setRoles('roles' in auth ? auth.roles : undefined);
        setPermissions('permissions' in auth ? auth.permissions : undefined);
        setEntitlements('entitlements' in auth ? auth.entitlements : undefined);
        setFeatureFlags('featureFlags' in auth ? auth.featureFlags : undefined);
        setImpersonator('impersonator' in auth ? auth.impersonator : undefined);
      } catch (error) {
        return error instanceof Error ? { error: error.message } : { error: String(error) };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSignOut = useCallback(async ({ returnTo }: { returnTo?: string } = {}) => {
    await signOut({ data: { returnTo } });
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
