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

type Child = { id: string; full_name: string; grade_level: string; section_id: string | null };
type Schedule = {
  id: string; day: string; start_time: string; end_time: string; room: string;
  subject_name: string; subject_code: string; teacher_name: string;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const NEU = {
  bg: '#E8EDF2',
  bgDark: '#D1D9E6',
  lightShadow: '#FFFFFF',
  darkShadow: '#A3B1C6',
  text: '#2E3A4D',
  textMuted: '#7A8699',
  textFaint: '#A0ACBE',
};

export default function ParentSchedule() {
  const { theme, primaryColor } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');

  useEffect(() => { loadChildren(); }, []);
  useEffect(() => { if (selectedChild) loadSchedule(selectedChild); }, [selectedChild]);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) { setLoading(false); return; }

      const { data: userData } = await supabase
        .from('users').select('id').eq('email', email).maybeSingle();
      if (!userData) { setLoading(false); return; }

      const { data: kids } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade_level, section_id')
        .eq('parent_id', userData.id);

      if (kids && kids.length > 0) {
        const list = kids.map((k: any) => ({
          id: k.id,
          full_name: `${k.first_name || ''} ${k.last_name || ''}`.trim() || 'Unknown',
          grade_level: k.grade_level || 'N/A',
          section_id: k.section_id || null,
        }));
        setChildren(list);
        setSelectedChild(list[0]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadSchedule = async (child: Child) => {
    setLoading(true);
    try {
      if (!child.section_id) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      const { data: scheds } = await supabase
        .from('schedules')
        .select('id, day, start_time, end_time, room, subject_id, teacher_id')
        .eq('section_id', child.section_id)
        .order('start_time');

      if (!scheds || scheds.length === 0) {
        setSchedules([]);
        setLoading(false);
        return;
      }

      const subjectIds = [...new Set(scheds.map((s: any) => s.subject_id).filter(Boolean))];
      const teacherIds = [...new Set(scheds.map((s: any) => s.teacher_id).filter(Boolean))];

      const subjectMap: Record<string, any> = {};
      const teacherMap: Record<string, any> = {};

      if (subjectIds.length > 0) {
        const { data: subs } = await supabase
          .from('subjects').select('id, name, code').in('id', subjectIds);
        (subs || []).forEach((s: any) => { subjectMap[s.id] = s; });
      }

      if (teacherIds.length > 0) {
        const { data: teachers } = await supabase
          .from('teachers')
          .select(`id, users:user_id (first_name, last_name)`)
          .in('id', teacherIds);

        (teachers || []).forEach((t: any) => {
          const u = Array.isArray(t.users) ? t.users[0] : t.users;
          teacherMap[t.id] = u
            ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'TBA'
            : 'TBA';
        });
      }

      const formatted: Schedule[] = scheds.map((s: any) => ({
        id: s.id,
        day: s.day || 'Monday',
        start_time: s.start_time || '',
        end_time: s.end_time || '',
        room: s.room || 'TBA',
        subject_name: subjectMap[s.subject_id]?.name || 'Unknown Subject',
        subject_code: subjectMap[s.subject_id]?.code || '',
        teacher_name: teacherMap[s.teacher_id] || 'TBA',
      }));

      setSchedules(formatted);

      const firstDay = DAYS.find(d => formatted.some(s => s.day === d));
      if (firstDay) setSelectedDay(firstDay);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const formatTime = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const daySchedules = schedules.filter(s => s.day === selectedDay);

  if (loading && children.length === 0) {
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Schedule</Text>
          <View style={{ width: 44 }} />
        </View>

        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childPicker}>
            {children.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.childChip,
                  selectedChild?.id === c.id && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}
                onPress={() => setSelectedChild(c)}
              >
                <Text
                  style={[
                    styles.childChipText,
                    selectedChild?.id === c.id && { color: '#fff', fontWeight: '700' },
                  ]}
                >
                  {c.full_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedChild && (
          <View style={styles.childInfoCard}>
            <View style={[styles.avatar, { backgroundColor: primaryColor + '15' }]}>
              <Text style={[styles.avatarText, { color: primaryColor }]}>
                {selectedChild.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.childName}>{selectedChild.full_name}</Text>
              <Text style={styles.childMeta}>Grade {selectedChild.grade_level}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.smallLabel}>Classes</Text>
              <Text style={styles.smallValue}>{schedules.length}</Text>
            </View>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker}>
          {DAYS.map(d => {
            const count = schedules.filter(s => s.day === d).length;
            const isActive = selectedDay === d;
            return (
              <TouchableOpacity
                key={d}
                style={[
                  styles.dayChip,
                  isActive && { backgroundColor: primaryColor, borderColor: primaryColor },
                ]}
                onPress={() => setSelectedDay(d)}
              >
                <Text style={[styles.dayChipText, { color: isActive ? '#fff' : NEU.textMuted }]}>
                  {d.slice(0, 3)}
                </Text>
                <Text style={[styles.dayChipCount, { color: isActive ? '#fff' : NEU.textMuted }]}>
                  {count} {count === 1 ? 'class' : 'classes'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {daySchedules.length > 0 ? (
          daySchedules.map(s => (
            <View key={s.id} style={styles.scheduleCard}>
              <View style={[styles.scheduleBar, { backgroundColor: primaryColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.subjectName}>{s.subject_name}</Text>
                {s.subject_code ? (
                  <Text style={styles.subjectCode}>{s.subject_code}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    🕐 {formatTime(s.start_time)} – {formatTime(s.end_time)}
                  </Text>
                  <Text style={styles.metaText}>📍 {s.room}</Text>
                  <Text style={styles.metaText}>👤 {s.teacher_name}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={50} color={NEU.textMuted} />
            <Text style={styles.emptyText}>No classes on {selectedDay}</Text>
          </View>
        )}
      </ScrollView>

      <ParentSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NEU.bg },
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingOrb: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingTop: 16,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.7, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  title: { fontSize: 18, fontWeight: '700', color: NEU.text },

  childPicker: { marginBottom: 8 },
  childChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginRight: 8, borderWidth: 1,
    backgroundColor: NEU.bg, borderColor: NEU.bgDark,
  },
  childChipText: { fontSize: 13, color: NEU.textMuted },

  childInfoCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, padding: 16, marginBottom: 16, gap: 16,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  childName: { fontSize: 15, fontWeight: '600', color: NEU.text },
  childMeta: { fontSize: 11, color: NEU.textMuted, marginTop: 2 },
  smallLabel: { fontSize: 11, color: NEU.textMuted },
  smallValue: { fontSize: 18, fontWeight: '800', color: NEU.text },

  dayPicker: { marginBottom: 16 },
  dayChip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 14, marginRight: 8, borderWidth: 1,
    alignItems: 'center', minWidth: 78,
    backgroundColor: NEU.bg, borderColor: NEU.bgDark,
  },
  dayChipText: { fontSize: 13, fontWeight: '700' },
  dayChipCount: { fontSize: 11, marginTop: 2 },

  scheduleCard: {
    flexDirection: 'row', borderRadius: 20,
    padding: 16, marginBottom: 10, gap: 12,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.55, shadowRadius: 10, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  scheduleBar: { width: 4, borderRadius: 2 },
  subjectName: { fontSize: 14, fontWeight: '600', color: NEU.text },
  subjectCode: { fontSize: 11, color: NEU.textMuted, marginTop: 2 },
  metaRow: { marginTop: 8, gap: 2 },
  metaText: { fontSize: 11, color: NEU.textMuted },

  emptyContainer: {
    alignItems: 'center', padding: 40, borderRadius: 20,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  emptyText: { fontSize: 15, color: NEU.textMuted, marginTop: 16, fontWeight: '600' },
});