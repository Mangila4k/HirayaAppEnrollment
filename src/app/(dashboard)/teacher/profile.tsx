import { useTheme } from '@/app/_context/themecontext';
import NotificationBell from '@/components/NotificationBell';
import TeacherSidebar from '@/components/TeacherSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NEU = {
  bg: '#E8EDF2', bgDark: '#D1D9E6', lightShadow: '#FFFFFF',
  darkShadow: '#A3B1C6', text: '#2E3A4D', textMuted: '#7A8699',
  textFaint: '#A0ACBE', accent: '#4C6FFF', danger: '#EF4444',
};

type Profile = {
  id: string; user_id: string; employee_id: string; specialization: string;
  phone: string; address: string; first_name: string; last_name: string;
  email: string; created_at: string;
};

export default function TeacherProfile() {
  const router = useRouter();
  const { theme, primaryColor } = useTheme();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) { setLoading(false); return; }
      const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
      if (!userData) { setLoading(false); return; }
      const { data: teacherData } = await supabase.from('teachers').select('*').eq('user_id', userData.id).maybeSingle();
      setProfile({
        id: teacherData?.id || userData.id,
        user_id: userData.id,
        employee_id: teacherData?.employee_id || 'N/A',
        specialization: teacherData?.specialization || 'N/A',
        phone: teacherData?.phone || 'N/A',
        address: teacherData?.address || 'N/A',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        created_at: userData.created_at,
      });
    } finally { setLoading(false); }
  };

  const getInitials = () => {
    if (!profile) return 'T';
    return `${(profile.first_name || '').charAt(0)}${(profile.last_name || '').charAt(0)}`.toUpperCase() || 'T';
  };

  const getFullName = () => {
    if (!profile) return 'Teacher';
    return `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Teacher';
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)}>
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>
          <Text style={styles.title}>My Profile</Text>
          <NotificationBell iconColor={NEU.text} />
        </View>

        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: primaryColor + '15' }]}>
            <Text style={[styles.avatarText, { color: primaryColor }]}>{getInitials()}</Text>
          </View>
          <Text style={styles.name}>{getFullName()}</Text>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Faculty Information</Text>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Employee ID</Text><Text style={styles.infoValue}>{profile?.employee_id}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Specialization</Text><Text style={styles.infoValue}>{profile?.specialization}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Phone</Text><Text style={styles.infoValue}>{profile?.phone}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Address</Text><Text style={styles.infoValue}>{profile?.address}</Text></View>
        </View>
      </ScrollView>
      <TeacherSidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NEU.bg },
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: NEU.bg },
  title: { fontSize: 18, fontWeight: '700', color: NEU.text },
  profileCard: { padding: 20, borderRadius: 20, backgroundColor: NEU.bg, marginBottom: 16, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 30, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700', color: NEU.text, marginTop: 12 },
  email: { fontSize: 13, color: NEU.textMuted, marginTop: 4 },
  infoCard: { padding: 20, borderRadius: 20, backgroundColor: NEU.bg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: NEU.text, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 1, borderTopColor: NEU.bgDark },
  infoLabel: { fontSize: 13, color: NEU.textMuted },
  infoValue: { fontSize: 13, fontWeight: '600', color: NEU.text },
});