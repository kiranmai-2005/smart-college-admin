import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Building2, Save, Loader2, Upload } from 'lucide-react';

interface CollegeSettings {
  id?: string;
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

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CollegeSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSettings();
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
        throw error;
      }

      if (data) {
        setSettings({
          id: data.id,
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
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const settingsData = {
        user_id: user.id,
        college_name: settings.college_name,
        college_short_name: settings.college_short_name,
        affiliation: settings.affiliation,
        accreditation: settings.accreditation,
        certifications: settings.certifications,
        address: settings.address,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        logo_url: settings.logo_url,
      };

      if (settings.id) {
        const { error } = await supabase
          .from('college_settings')
          .update(settingsData)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('college_settings')
          .insert(settingsData);

        if (error) throw error;
      }

      toast.success('Settings saved successfully!');
      fetchSettings();
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CollegeSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Use signed URL instead of public URL for security
      // Signed URL expires in 1 year (31536000 seconds)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('documents')
        .createSignedUrl(fileName, 31536000);

      if (urlError) throw urlError;

      updateField('logo_url', urlData.signedUrl);
      toast.success('Logo uploaded!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Settings" description="Configure your college details">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="College Settings" 
      description="Customize college name, branding and details for document generation"
    >
      <div className="max-w-4xl space-y-6">
        <Card className="card-academic">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gold" />
              Institution Details
            </CardTitle>
            <CardDescription>
              These details will appear on all generated documents (circulars, notices, timetables)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* College Name */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="college_name">College/Institution Name *</Label>
                <Input
                  id="college_name"
                  placeholder="Full college name"
                  value={settings.college_name}
                  onChange={(e) => updateField('college_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="college_short_name">Short Name / Abbreviation</Label>
                <Input
                  id="college_short_name"
                  placeholder="e.g., VIEW, MIT, IIT"
                  value={settings.college_short_name}
                  onChange={(e) => updateField('college_short_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo">College Logo</Label>
                <div className="flex items-center gap-3">
                  {settings.logo_url && (
                    <img 
                      src={settings.logo_url} 
                      alt="Logo" 
                      className="h-12 w-12 object-contain rounded border"
                    />
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Logo
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>

            {/* Affiliation & Accreditation */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="affiliation">Affiliation Details</Label>
                <Textarea
                  id="affiliation"
                  placeholder="e.g., Approved by AICTE & Affiliated to XYZ University"
                  value={settings.affiliation}
                  onChange={(e) => updateField('affiliation', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accreditation">Accreditation Details</Label>
                <Textarea
                  id="accreditation"
                  placeholder="e.g., Accredited by NBA for UG Programmes | NAAC A+"
                  value={settings.accreditation}
                  onChange={(e) => updateField('accreditation', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certifications">Certifications (ISO, etc.)</Label>
                <Input
                  id="certifications"
                  placeholder="e.g., ISO 9001:2015, ISO 14001:2015 Certified"
                  value={settings.certifications}
                  onChange={(e) => updateField('certifications', e.target.value)}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="Full address"
                  value={settings.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="Phone number"
                  value={settings.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email address"
                  value={settings.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://..."
                  value={settings.website}
                  onChange={(e) => updateField('website', e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card className="card-academic">
          <CardHeader>
            <CardTitle>Document Header Preview</CardTitle>
            <CardDescription>This is how your letterhead will appear on documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div 
              className="p-6 rounded-lg border-2 border-dashed"
              style={{ backgroundColor: '#ffffff' }}
            >
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-4 mb-2">
                  {settings.logo_url && (
                    <img src={settings.logo_url} alt="Logo" className="h-12 w-12 object-contain" />
                  )}
                  <h2 
                    className="text-lg font-bold uppercase"
                    style={{ color: '#1e3a5f' }}
                  >
                    {settings.college_name || 'College Name'}
                  </h2>
                  {settings.logo_url && (
                    <img src={settings.logo_url} alt="Logo" className="h-12 w-12 object-contain" />
                  )}
                </div>
                {settings.affiliation && (
                  <p className="text-xs" style={{ color: '#374151' }}>
                    {settings.affiliation}
                  </p>
                )}
                {settings.accreditation && (
                  <p className="text-xs" style={{ color: '#374151' }}>
                    {settings.accreditation}
                  </p>
                )}
                {settings.certifications && (
                  <p className="text-xs" style={{ color: '#374151' }}>
                    {settings.certifications}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
