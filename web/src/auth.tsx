import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { request } from "./api";

export type Area =
  | "dashboard"
  | "inventory"
  | "parties"
  | "purchases"
  | "sales"
  | "payments"
  | "movements"
  | "reports"
  | "settings";
export type Level = "view" | "edit";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  company: string;
  phone?: string;
  title?: string;
  photo?: string | null;
  twoFactor: boolean;
  demo?: boolean;
  role?: "owner" | "member" | "super";
  isSuper?: boolean;
  permissions?: Partial<Record<Area, Level>>;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  setUser: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<AuthUser | null>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    await request("/auth/signout", "POST").catch(() => {});
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, setUser, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
