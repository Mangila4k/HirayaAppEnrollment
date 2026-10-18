import { useTheme } from '@/app/_context/themecontext';
import NotificationBell from '@/components/NotificationBell';
import ParentSidebar from '@/components/ParentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export default function ParentDashboard() {
  const router = useRouter();
  const { primaryColor } = useTheme();
  const [loading, setLoading] = useState(true);
  const [parentName, setParentName] = useState('Parent');
  const [summaries, setSummaries] = useState<any[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;

      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('email', email)
        .maybeSingle();

      if (!userData) return;
      setParentName(`${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Parent');

      let kids = [];
      const { data: linkedKids } = await supabase.from('students').select('*').eq('parent_id', userData.id);
      if (linkedKids && linkedKids.length > 0) {
        kids = linkedKids;
      } else {
        const lastName = userData.last_name || '';
        if (lastName) {
          const { data: fallbackKids } = await supabase
            .from('students')
            .select('*')
            .or(`last_name.ilike.%${lastName}%,parent_name.ilike.%${lastName}%`);
          if (fallbackKids) kids = fallbackKids;
        }
      }

      if (kids.length === 0) {
        setSummaries([]);
        return;
      }

      const summaryPromises = kids.map(async (kid: any) => {
        const { data: gradesData } = await supabase.from('grades').select('grade').eq('student_id', kid.id);
        const gradeAverage = gradesData && gradesData.length > 0
          ? Math.round((gradesData.reduce((s, g) => s + (g.grade || 0), 0) / gradesData.length) * 100) / 100
          : null;

        const { data: attData } = await supabase.from('attendance').select('status').eq('student_id', kid.id);
        let attendanceRate = null;
        if (attData && attData.length > 0) {
          const present = attData.filter((a) => ['present', 'late', 'excused'].includes(String(a.status).toLowerCase())).length;
          attendanceRate = Math.round((present / attData.length) * 100);
        }

        let sectionName = 'No Section';
        if (kid.section_id) {
          const { data: sec } = await supabase.from('sections').select('name').eq('id', kid.section_id).maybeSingle();
          if (sec) sectionName = sec.name;
        }

        return {
          child: {
            id: kid.id,
            full_name: `${kid.first_name || ''} ${kid.last_name || ''}`.trim() || 'Unknown',
            grade_level: kid.grade_level || 'N/A',
            section_name: sectionName,
          },
          gradeAverage,
          attendanceRate,
        };
      });

      setSummaries(await Promise.all(summaryPromises));
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const gradeColor = (g: number | null) => {
    if (g === null) return THEME.textMuted;
    if (g >= 90) return THEME.success;
    if (g >= 85) return '#8BC34A';
    if (g >= 75) return THEME.warning;
    return THEME.danger;
  };

  const rateColor = (r: number | null) => {
    if (r === null) return THEME.textMuted;
    if (r >= 95) return THEME.success;
    if (r >= 85) return '#8BC34A';
    if (r >= 75) return THEME.warning;
    return THEME.danger;
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
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)}>
            <Ionicons name="menu-outline" size={22} color={THEME.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>{parentName}</Text>
            <Text style={styles.subGreeting}>{summaries.length} Children Linked</Text>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell iconColor={THEME.text} />
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(dashboard)/parent/profile')}>
              <Ionicons name="person-outline" size={20} color={THEME.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Children List */}
        {summaries.map((s) => (
          <View key={s.child.id} style={styles.card}>
            <View style={styles.childHeader}>
              <View style={[styles.avatar, { backgroundColor: primaryColor + '15' }]}>
                <Text style={[styles.avatarText, { color: primaryColor }]}>
                  {s.child.full_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{s.child.full_name}</Text>
                <Text style={styles.childMeta}>
                  {s.child.grade_level} • {s.child.section_name}
                </Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>General Average</Text>
              <Text style={[styles.infoValue, { color: gradeColor(s.gradeAverage) }]}>
                {s.gradeAverage !== null ? `${s.gradeAverage}%` : '—'}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Attendance Standing</Text>
              <Text style={[styles.infoValue, { color: rateColor(s.attendanceRate) }]}>
                {s.attendanceRate !== null ? `${s.attendanceRate}%` : '—'}
              </Text>
            </View>
          </View>
        ))}

      </ScrollView>
      <ParentSidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.bg },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  greeting: { fontSize: 16, fontWeight: '700', color: THEME.text },
  subGreeting: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  
  card: {
    padding: 20, marginBottom: 16, borderRadius: 16, backgroundColor: THEME.card,
    borderWidth: 1, borderColor: THEME.border,
  },
  childHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  childName: { fontSize: 15, fontWeight: '700', color: THEME.text },
  childMeta: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  infoLabel: { fontSize: 13, color: THEME.textMuted },
  infoValue: { fontSize: 13, fontWeight: '700', color: THEME.text },
  divider: { height: 1, backgroundColor: THEME.border },
});