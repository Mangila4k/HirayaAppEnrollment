import { useTheme } from '@/app/_context/themecontext';
import TeacherSidebar from '@/components/TeacherSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NEU = {
  bg: '#E8EDF2', bgDark: '#D1D9E6', lightShadow: '#FFFFFF',
  darkShadow: '#A3B1C6', text: '#2E3A4D', textMuted: '#7A8699',
  textFaint: '#A0ACBE', danger: '#EF4444',
};

type Schedule = {
  id: string; day: string; time_start: string; time_end: string;
  subject_name: string; subject_code: string; section_name: string; room: string;
};

export default function TeacherSchedule() {
  const { primaryColor, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { loadSchedule(); }, []);

  const formatTime = (t: string) => {
    if (!t) return 'N/A';
    if (t.includes('AM') || t.includes('PM')) return t;
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) { setLoading(false); return; }
      const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
      if (!userData) { setLoading(false); return; }
      const { data: teacherData } = await supabase.from('teachers').select('id').eq('user_id', userData.id).maybeSingle();
      if (!teacherData) { setLoading(false); return; }
      const { data } = await supabase.from('schedules').select('*').eq('teacher_id', teacherData.id);
      if (!data) { setLoading(false); return; }
      const subjectIds = [...new Set(data.map((s: any) => s.subject_id).filter(Boolean))];
      const sectionIds = [...new Set(data.map((s: any) => s.section_id).filter(Boolean))];
      const subjectMap: Record<string, any> = {};
      const sectionMap: Record<string, any> = {};
      if (subjectIds.length > 0) {
        const { data: subs } = await supabase.from('subjects').select('id, name, code').in('id', subjectIds);
        (subs || []).forEach((s: any) => { subjectMap[s.id] = s; });
      }
      if (sectionIds.length > 0) {
        const { data: secs } = await supabase.from('sections').select('id, name').in('id', sectionIds);
        (secs || []).forEach((s: any) => { sectionMap[s.id] = s; });
      }
      const formatted: Schedule[] = data.map((s: any) => ({
        id: s.id, day: s.day || 'N/A',
        time_start: formatTime(s.start_time), time_end: formatTime(s.end_time),
        subject_name: subjectMap[s.subject_id]?.name || 'Unknown',
        subject_code: subjectMap[s.subject_id]?.code || '',
        section_name: sectionMap[s.section_id]?.name || 'No Section',
        room: s.room || 'N/A',
      }));
      setSchedules(formatted);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const groupByDay = () => {
    const grouped: Record<string, Schedule[]> = {};
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach(d => (grouped[d] = []));
    schedules.forEach(s => { if (!grouped[s.day]) grouped[s.day] = []; grouped[s.day].push(s); });
    return grouped;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingOrb}>
            <ActivityIndicator size="small" color={primaryColor} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const grouped = groupByDay();
  const daysWithClasses = Object.keys(grouped).filter(d => grouped[d].length > 0);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>My Schedule</Text>
            <Text style={styles.subGreeting}>Weekly class timetable</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={loadSchedule} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={20} color={NEU.text} />
          </TouchableOpacity>
        </View>

        {daysWithClasses.length > 0 ? (
          daysWithClasses.map(day => (
            <View key={day} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{day}</Text>
                <View style={[styles.dayBadge, { backgroundColor: primaryColor + '12' }]}>
                  <Text style={[styles.dayBadgeText, { color: primaryColor }]}>
                    {grouped[day].length} class{grouped[day].length !== 1 ? 'es' : ''}
                  </Text>
                </View>
              </View>
              {grouped[day]
                .sort((a, b) => a.time_start.localeCompare(b.time_start))
                .map(s => (
                  <View key={s.id} style={styles.scheduleCard}>
                    <View style={styles.timeBox}>
                      <Text style={[styles.timeStart, { color: primaryColor }]}>{s.time_start}</Text>
                      <Text style={styles.timeEnd}>{s.time_end}</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.subjectName} numberOfLines={1}>{s.subject_name}</Text>
                      {s.subject_code ? (
                        <Text style={[styles.subjectCode, { color: primaryColor }]}>{s.subject_code}</Text>
                      ) : null}
                      <View style={styles.metaRow}>
                        <Ionicons name="school-outline" size={12} color={NEU.textMuted} />
                        <Text style={styles.metaText}>{s.section_name}</Text>
                      </View>
                      {s.room !== 'N/A' && (
                        <View style={styles.metaRow}>
                          <Ionicons name="location-outline" size={12} color={NEU.textMuted} />
                          <Text style={styles.metaText}>{s.room}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
            </View>
          ))
        ) : (
          <View style={styles.infoCard}>
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={48} color={NEU.textMuted} />
              <Text style={styles.emptyTitle}>No schedule assigned</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <TeacherSidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NEU.bg },
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingOrb: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.lightShadow, shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 },
  headerCenter: { flex: 1, alignItems: 'center' },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
    borderRightWidth: 1, borderBottomWidth: 1,
    borderRightColor: 'rgba(163,177,198,0.4)',
    borderBottomColor: 'rgba(163,177,198,0.4)',
  },
  greeting: { fontSize: 16, fontWeight: '700', color: NEU.text, letterSpacing: -0.2 },
  subGreeting: { fontSize: 12, color: NEU.textMuted, marginTop: 2, letterSpacing: 0.2 },
  daySection: { marginBottom: 24 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  dayTitle: { fontSize: 12, fontWeight: '700', color: NEU.textFaint, letterSpacing: 1.2, textTransform: 'uppercase' },
  dayBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  dayBadgeText: { fontSize: 11, fontWeight: '700' },
  scheduleCard: {
    flexDirection: 'row', borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  timeBox: {
    alignItems: 'center', justifyContent: 'center',
    paddingRight: 14, marginRight: 14,
    borderRightWidth: 1, borderRightColor: NEU.bgDark, minWidth: 82,
  },
  timeStart: { fontSize: 13, fontWeight: '700' },
  timeEnd: { fontSize: 11, marginTop: 2, color: NEU.textMuted },
  scheduleInfo: { flex: 1, justifyContent: 'center' },
  subjectName: { fontSize: 14, fontWeight: '600', color: NEU.text },
  subjectCode: { fontSize: 11, marginTop: 2, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: 11, color: NEU.textMuted },
  infoCard: {
    paddingVertical: 8, paddingHorizontal: 20, marginBottom: 20,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 13, color: NEU.textMuted, marginTop: 12, textAlign: 'center' },
});