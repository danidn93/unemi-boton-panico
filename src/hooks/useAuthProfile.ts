import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAuthProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.session.user.id)
        .single();

      setProfile(data);
      setLoading(false);
    };

    load();
  }, []);

  return { profile, loading };
}
