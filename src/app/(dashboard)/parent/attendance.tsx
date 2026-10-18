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
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export default function ParentAttendance() {
  const { primaryColor } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => { loadChildren(); }, []);
  useEffect(() => { if (selectedChild) loadAttendance(selectedChild); }, [selectedChild]);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;

      const { data: userData } = await supabase.from('users').select('id, last_name').eq('email', email).maybeSingle();
      if (!userData) return;

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

      if (kids.length > 0) {
        const list = kids.map((k: any) => ({
          id: k.id,
          full_name: `${k.first_name || ''} ${k.last_name || ''}`.trim(),
          grade_level: k.grade_level || 'N/A',
          section_id: k.section_id,
        }));
        setChildren(list);
        setSelectedChild(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async (child: any) => {
    setLoading(true);
    try {
      const { data: attData } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', child.id)
        .order('date', { ascending: false });

      if (attData) {
        const cleaned = attData
          .filter(r => {
            const d = new Date(r.date + 'T00:00:00');
            return d.getDay() !== 0 && d.getDay() !== 6;
          })
          .map(r => ({
            ...r,
            status: (r.status || 'Present').charAt(0).toUpperCase() + (r.status || 'Present').slice(1).toLowerCase()
          }));
        setRecords(cleaned);
      } else {
        setRecords([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const total = records.length;
  const present = records.filter(r => r.status === 'Present').length;
  const late = records.filter(r => r.status === 'Late').length;
  const absent = records.filter(r => r.status === 'Absent').length;
  const excused = records.filter(r => r.status === 'Excused').length;
  const totalAttended = present + late + excused;
  const rate = total > 0 ? Math.round((totalAttended / total) * 100) : 0;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecord = records.find(r => r.date === todayStr);

  if (loading && children.length === 0) {
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
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowSidebar(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Attendance</Text>
          <View style={{ width: 44 }} />
        </View>

        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {children.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.childChip, selectedChild?.id === c.id && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                onPress={() => setSelectedChild(c)}
              >
                <Text style={[styles.childChipText, selectedChild?.id === c.id && { color: '#fff', fontWeight: '700' }]}>
                  {c.full_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedChild && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <View style={[styles.avatar, { backgroundColor: primaryColor + '15' }]}>
                <Text style={[styles.avatarText, { color: primaryColor }]}>{selectedChild.full_name.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.name}>{selectedChild.full_name}</Text>
                <Text style={styles.meta}>{selectedChild.grade_level}</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>RATE</Text>
                <Text style={styles.statVal}>{rate}%</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>PRESENT</Text>
                <Text style={[styles.statVal, { color: THEME.success }]}>{present}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>LATE</Text>
                <Text style={[styles.statVal, { color: THEME.warning }]}>{late}</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>ABSENT</Text>
                <Text style={[styles.statVal, { color: THEME.danger }]}>{absent + excused}</Text>
              </View>
            </View>

            <Text style={styles.sectionHeading}>Today's Status</Text>
            <View style={[styles.statusBox, { backgroundColor: todayRecord ? THEME.success + '15' : THEME.bg }]}>
              <Text style={[styles.statusText, { color: todayRecord ? THEME.success : THEME.textMuted }]}>
                {todayRecord ? todayRecord.status : 'Not Yet Recorded'}
              </Text>
              <Text style={styles.statusSub}>
                {todayRecord ? todayRecord.remarks || 'Recorded' : 'Awaiting teacher roll call'}
              </Text>
            </View>

            <Text style={styles.sectionHeading}>Attendance Records</Text>
            {records.length === 0 ? (
              <Text style={{ color: THEME.textMuted, textAlign: 'center', padding: 20 }}>No records found.</Text>
            ) : (
              records.map(r => (
                <View key={r.id} style={styles.recordRow}>
                  <View>
                    <Text style={styles.recordDate}>{new Date(r.date).toLocaleDateString()}</Text>
                    <Text style={styles.recordRemarks}>{r.remarks || 'On time'}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: r.status === 'Present' ? THEME.success + '15' : r.status === 'Late' ? THEME.warning + '15' : THEME.danger + '15' }]}>
                    <Text style={[styles.badgeText, { color: r.status === 'Present' ? THEME.success : r.status === 'Late' ? THEME.warning : THEME.danger }]}>{r.status}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

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
  childChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, backgroundColor: THEME.card, borderColor: THEME.border },
  childChipText: { fontSize: 13, color: THEME.textMuted },
  card: { padding: 20, borderRadius: 16, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700', color: THEME.text },
  meta: { fontSize: 12, color: THEME.textMuted },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginBottom: 16 },
  statCard: { width: '48%', padding: 12, backgroundColor: THEME.bg, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
  statLabel: { fontSize: 10, fontWeight: '700', color: THEME.textMuted },
  statVal: { fontSize: 18, fontWeight: '800', color: THEME.text, marginTop: 4 },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: THEME.text, marginBottom: 10, marginTop: 10 },
  statusBox: { padding: 14, borderRadius: 12, marginBottom: 16 },
  statusText: { fontSize: 16, fontWeight: '800' },
  statusSub: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.border },
  recordDate: { fontSize: 13, fontWeight: '700', color: THEME.text },
  recordRemarks: { fontSize: 11, color: THEME.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
});