import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface CollegeSettings {
  college_name: string;
  college_short_name: string;
  affiliation: string;
  accreditation: string;
  certifications: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
}

const defaultSettings: CollegeSettings = {
  college_name: "VIGNAN'S INSTITUTE OF ENGINEERING FOR WOMEN",
  college_short_name: 'VIEW',
  affiliation: 'Approved by AICTE & Affiliated to JNTU-GV, Vizianagaram',
  accreditation: 'Accredited by NBA for UG Programmes of EEE, ECE, CSE & IT | NAAC A+',
  certifications: 'ISO 9001:2015, ISO 14001:2015, ISO 45001:2018 Certified Institution',
  address: '',
  phone: '',
  email: '',
  website: '',
  logo_url: '/default-logo.png',
};

export function useCollegeSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CollegeSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSettings();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('college_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching college settings:', error);
      }

      if (data) {
        setSettings({
          college_name: data.college_name || defaultSettings.college_name,
          college_short_name: data.college_short_name || defaultSettings.college_short_name,
          affiliation: data.affiliation || defaultSettings.affiliation,
          accreditation: data.accreditation || defaultSettings.accreditation,
          certifications: data.certifications || defaultSettings.certifications,
          address: data.address || '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          logo_url: data.logo_url || defaultSettings.logo_url,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, refetch: fetchSettings };
}
