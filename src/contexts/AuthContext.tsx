import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./../lib/supabase";

type Role = "ADMIN" | "OPERATOR" | "STUDENT" | "STAFF" | null;

interface AuthContextType {
  role: Role;
  loading: boolean;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  loading: true,
  refreshRole: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  const refreshRole = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) {
      setRole(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.session.user.id)
      .single();

    if (!error) {
      setRole(data.role);
    }

    setLoading(false);
  };

  useEffect(() => {
    refreshRole();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshRole();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ role, loading, refreshRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
