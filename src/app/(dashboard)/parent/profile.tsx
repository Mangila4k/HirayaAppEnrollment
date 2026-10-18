import { useTheme } from '@/app/_context/themecontext';
import ParentSidebar from '@/components/ParentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const THEME = {
  bg: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E5EAF2',
  royalBlue: '#1E3A8A',
  royalBlueSoft: 'rgba(30,58,138,0.10)',
  text: '#1A202C',
  textMuted: '#8A94A6',
};

export default function ParentProfile() {
  const { primaryColor } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (userData) {
        setProfile(userData);

        let kids = [];
        const { data: linkedKids } = await supabase.from('students').select('*').eq('parent_id', userData.id);
        if (linkedKids && linkedKids.length > 0) {
          kids = linkedKids;
        } else {
          const lastName = userData.last_name || '';
          if (lastName) {
            const { data: fallback } = await supabase.from('students').select('*').or(`last_name.ilike.%${lastName}%,parent_name.ilike.%${lastName}%`);
            if (fallback) kids = fallback;
          }
        }

        setChildren(kids.map((k: any) => ({
          id: k.id,
          name: `${k.first_name || ''} ${k.last_name || ''}`.trim(),
          lrn: k.lrn || 'N/A',
          grade: k.grade_level || 'N/A',
          strand: k.strand || 'N/A',
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={primaryColor} />
        </View>
      </SafeAreaView>
    );
  }

  const initials = profile
    ? `${(profile.first_name || '').charAt(0)}${(profile.last_name || '').charAt(0)}`.toUpperCase() || 'P'
    : 'P';

  const fullName = profile
    ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Parent'
    : 'Parent';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowSidebar(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.card}>
          <View style={[styles.avatar, { backgroundColor: primaryColor + '15' }]}>
            <Text style={[styles.avatarText, { color: primaryColor }]}>{initials}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>My Children ({children.length})</Text>
          {children.length === 0 ? (
            <Text style={{ color: THEME.textMuted, textAlign: 'center', padding: 20 }}>No linked students found.</Text>
          ) : (
            children.map(c => (
              <View key={c.id} style={styles.childRow}>
                <View style={[styles.childAvatar, { backgroundColor: primaryColor + '15' }]}>
                  <Text style={[styles.childInitial, { color: primaryColor }]}>{c.name.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.childName}>{c.name}</Text>
                  <Text style={styles.childMeta}>LRN: {c.lrn} • {c.grade} • {c.strand}</Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
      <ParentSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.bg },
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  title: { fontSize: 18, fontWeight: '700', color: THEME.text },
  card: { padding: 20, borderRadius: 16, backgroundColor: THEME.card, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700', color: THEME.text, marginTop: 12 },
  email: { fontSize: 13, color: THEME.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: THEME.text, marginBottom: 12, alignSelf: 'flex-start' },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: THEME.border },
  childAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  childInitial: { fontSize: 15, fontWeight: '800' },
  childName: { fontSize: 14, fontWeight: '600', color: THEME.text },
  childMeta: { fontSize: 11, color: THEME.textMuted, marginTop: 2 },
});