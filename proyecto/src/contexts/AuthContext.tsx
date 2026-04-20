import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  workshop_id: string;
  full_name: string;
  role: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const PROFILE_CACHE_KEY = 'autotech_profile';

const getCachedProfile = (): Profile | null => {
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const setCachedProfile = (profile: Profile | null) => {
  if (profile) {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  }
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(getCachedProfile);
  const [loading, setLoading] = useState(true);

  // Use a ref to track the current user ID to prevent stale closures
  const currentUserIdRef = useRef<string | null>(null);

  const fetchAndCacheProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // User confirmed to have no profile in DB
          setCachedProfile(null);
          return null;
        }
        // Network or other error — keep existing cached profile
        console.warn('Profile fetch error (keeping cache):', error.message);
        return getCachedProfile();
      }

      const newProfile = data as Profile;
      setCachedProfile(newProfile);
      return newProfile;
    } catch {
      // Network failure — keep existing cached profile
      return getCachedProfile();
    }
  };

  const refreshProfile = async () => {
    if (!currentUserIdRef.current) return;
    const updated = await fetchAndCacheProfile(currentUserIdRef.current);
    setProfile(updated);
  };

  const signOut = async () => {
    // Clear everything immediately for instant UI response
    currentUserIdRef.current = null;
    setCachedProfile(null);
    setProfile(null);
    setSession(null);
    setUser(null);
    await supabase.auth.signOut();
  };

  useEffect(() => {
    let isMounted = true;

    // Single source of truth: onAuthStateChange handles ALL session states.
    // We use getSession() only to trigger the first event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isMounted) return;

        if (event === 'SIGNED_OUT' || !newSession) {
          currentUserIdRef.current = null;
          setCachedProfile(null);
          setProfile(null);
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        // Session exists (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, etc.)
        setSession(newSession);
        setUser(newSession.user);
        currentUserIdRef.current = newSession.user.id;

        // Check if we already have a valid cached profile for this user
        const cached = getCachedProfile();
        if (cached && cached.id === newSession.user.id) {
          // Serve from cache immediately — no loading state needed
          setProfile(cached);
          setLoading(false);
          // Silently refresh in background
          fetchAndCacheProfile(newSession.user.id).then(updated => {
            if (isMounted && updated) setProfile(updated);
          });
        } else {
          // No cache or different user — must fetch before showing UI
          setLoading(true);
          const fetched = await fetchAndCacheProfile(newSession.user.id);
          if (isMounted) {
            setProfile(fetched);
            setLoading(false);
          }
        }
      }
    );

    // Trigger the initial auth check
    supabase.auth.getSession().catch(console.error);

    // Safety timeout: if loading is still true after 8s, unblock the UI
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 8000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
