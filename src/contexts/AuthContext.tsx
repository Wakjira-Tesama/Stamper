import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

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
  sendOtp: (email: string) => Promise<string | null>;
  resetPassword: (email: string, newPassword: string) => Promise<boolean>;
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
  const SEED_EMAIL = 'rabuma54@gmail.com';
  const SEED_PASSWORD = 'Rabuma@Z123';
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

  const sendOtp = async (email: string): Promise<string | null> => {
    if (email !== 'rabuma54@gmail.com') return null;
    
    // In a real app we'd send an email here.
    // We'll generate a hardcoded 6-digit OTP for testing/demo purposes.
    const otp = "123456"; 
    // Usually we save this to a DB table of otps. 
    // Here we'll just mock it and save temporarily if needed, though for local dev testing we can just expect '123456'.
    toast?.('An OTP has been sent to your email (Mock OTP: 123456)'); // Note, won't show real toast without provider, but logic is sound
    return otp;
  };

  const resetPassword = async (email: string, newPassword: string): Promise<boolean> => {
    if (email !== 'rabuma54@gmail.com') return false;
    
    // Hardcode rule: We just "reset" it but the login function is hardcoded to Rabuma@Z123. 
    // To actually support changing password, we need to remove the hardcoded check from login method 
    // and rely on local storage instead.
    
    // Let's update local storage user
    const users = getUsers();
    const userIndex = users.findIndex(u => u.email === email);
    if (userIndex === -1) return false;

    const newHash = await hashPassword(newPassword);
    users[userIndex].passwordHash = newHash;
    localStorage.setItem('ss_users', JSON.stringify(users));
    
    return true;
  };

  // Modify the login to actually check local storage hash again, instead of hardcoding the check, 
  // so the changed password can actually be used. 
  const login = async (email: string, password: string): Promise<boolean> => {
    if (email !== 'rabuma54@gmail.com') return false;

    const users = getUsers();
    const passwordHash = await hashPassword(password);
    const found = users.find(u => u.email === email && u.passwordHash === passwordHash);
    
    // Fallback if local storage was cleared - allow original password to seed it back
    if (!found) {
        if (password === 'Rabuma@Z123') {
            await ensureDefaultUser();
            return login(email, password); // retry after seeding
        }
        return false;
    }
    
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
    <AuthContext.Provider value={{ user, isLoading, login, logout, sendOtp, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}