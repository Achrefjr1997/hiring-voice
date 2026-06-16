import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface AuthState {
  token: string | null;
  recruiterId: string | null;
  email: string | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, recruiterId: string, email: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem("auth_token");
    const recruiterId = localStorage.getItem("auth_recruiter_id");
    const email = localStorage.getItem("auth_email");
    return { token, recruiterId, email };
  });

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.exp * 1000 < Date.now()) {
          logout();
        }
      } catch {
        logout();
      }
    }
  }, []);

  const login = (token: string, recruiterId: string, email: string) => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_recruiter_id", recruiterId);
    localStorage.setItem("auth_email", email);
    setState({ token, recruiterId, email });
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_recruiter_id");
    localStorage.removeItem("auth_email");
    setState({ token: null, recruiterId: null, email: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAuthenticated: !!state.token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
