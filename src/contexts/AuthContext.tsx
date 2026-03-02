import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  return crypto.randomUUID() + '.' + Date.now().toString(36);
}

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

// Seed default admin account
async function ensureDefaultUser() {
  const SEED_EMAIL = 'admin@rabuma.com';
  const SEED_PASSWORD = 'Rabuma@2024';
  const SEED_NAME = 'Rabuma Admin';

  try {
    const users: StoredUser[] = JSON.parse(localStorage.getItem('ss_users') || '[]');
    if (!users.find(u => u.email === SEED_EMAIL)) {
      const passwordHash = await hashPassword(SEED_PASSWORD);
      users.push({
        id: crypto.randomUUID(),
        email: SEED_EMAIL,
        name: SEED_NAME,
        passwordHash,
      });
      localStorage.setItem('ss_users', JSON.stringify(users));
    }
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('ss_session');
  }, []);

  // Check session on mount & seed default user
  useEffect(() => {
    ensureDefaultUser().then(() => {
      const session = localStorage.getItem('ss_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          if (Date.now() - parsed.lastActivity < INACTIVITY_TIMEOUT) {
            setUser(parsed.user);
          } else {
            localStorage.removeItem('ss_session');
          }
        } catch {
          localStorage.removeItem('ss_session');
        }
      }
      setIsLoading(false);
    });
  }, []);

  // Auto-logout on inactivity
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      const session = localStorage.getItem('ss_session');
      if (session) {
        const parsed = JSON.parse(session);
        parsed.lastActivity = Date.now();
        localStorage.setItem('ss_session', JSON.stringify(parsed));
      }
      timer = setTimeout(logout, INACTIVITY_TIMEOUT);
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [user, logout]);

  const getUsers = (): StoredUser[] => {
    try {
      return JSON.parse(localStorage.getItem('ss_users') || '[]');
    } catch {
      return [];
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    const users = getUsers();
    const passwordHash = await hashPassword(password);
    const found = users.find(u => u.email === email && u.passwordHash === passwordHash);
    if (!found) return false;

    const sessionUser = { id: found.id, email: found.email, name: found.name };
    setUser(sessionUser);
    localStorage.setItem('ss_session', JSON.stringify({
      token: generateToken(),
      user: sessionUser,
      lastActivity: Date.now(),
    }));
    return true;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}