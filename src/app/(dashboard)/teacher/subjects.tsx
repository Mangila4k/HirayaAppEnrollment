import { useTheme } from '@/app/_context/themecontext';
import TeacherSidebar from '@/components/TeacherSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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

type Subject = {
  id: string; name: string; code: string;
  section_name: string; section_id: string;
  subject_type: string; schedule_count: number;
};

export default function TeacherSubjects() {
  const router = useRouter();
  const { primaryColor, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { loadSubjects(); }, []);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) { setLoading(false); return; }
      const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
      if (!userData) { setLoading(false); return; }
      const { data: teacherData } = await supabase.from('teachers').select('id').eq('user_id', userData.id).maybeSingle();
      if (!teacherData) { setLoading(false); return; }
      const { data: scheds } = await supabase.from('schedules').select('subject_id, section_id').eq('teacher_id', teacherData.id);
      if (!scheds) { setLoading(false); return; }
      const keyMap: Record<string, { subject_id: string; section_id: string; count: number }> = {};
      scheds.forEach((s: any) => {
        const key = `${s.subject_id}_${s.section_id}`;
        if (!keyMap[key]) keyMap[key] = { subject_id: s.subject_id, section_id: s.section_id, count: 0 };
        keyMap[key].count++;
      });
      const subjectIds = [...new Set(Object.values(keyMap).map(v => v.subject_id).filter(Boolean))];
      const sectionIds = [...new Set(Object.values(keyMap).map(v => v.section_id).filter(Boolean))];
      const subjectData: Record<string, any> = {};
      const sectionData: Record<string, any> = {};
      if (subjectIds.length > 0) {
        const { data: subs } = await supabase.from('subjects').select('id, name, code, subject_type').in('id', subjectIds);
        (subs || []).forEach((s: any) => { subjectData[s.id] = s; });
      }
      if (sectionIds.length > 0) {
        const { data: secs } = await supabase.from('sections').select('id, name').in('id', sectionIds);
        (secs || []).forEach((s: any) => { sectionData[s.id] = s; });
      }
      const list: Subject[] = Object.values(keyMap).map(({ subject_id, section_id, count }) => ({
        id: subject_id,
        name: subjectData[subject_id]?.name || 'Unknown',
        code: subjectData[subject_id]?.code || 'N/A',
        subject_type: subjectData[subject_id]?.subject_type || 'N/A',
        section_name: sectionData[section_id]?.name || 'No Section',
        section_id,
        schedule_count: count,
      }));
      setSubjects(list);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getTypeColor = (t: string) => {
    switch (t) {
      case 'Core': return '#4CAF50';
      case 'Applied': return '#2196F3';
      case 'Specialized': return '#9C27B0';
      default: return NEU.textMuted;
    }
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>My Subjects</Text>
            <Text style={styles.subGreeting}>Subjects you teach</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={loadSubjects} activeOpacity={0.7}>
            <Ionicons name="refresh-outline" size={20} color={NEU.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={[styles.summaryIconWrap, { backgroundColor: primaryColor + '15' }]}>
            <Ionicons name="book-outline" size={20} color={primaryColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>Subjects Assigned</Text>
            <Text style={styles.summaryValue}>{subjects.length}</Text>
          </View>
        </View>

        {subjects.length > 0 ? (
          subjects.map(s => (
            <TouchableOpacity
              key={`${s.id}_${s.section_id}`}
              style={styles.subjectCard}
              onPress={() => router.push(`/(dashboard)/teacher/grades?subject=${s.id}&section=${s.section_id}` as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.subjectIcon, { backgroundColor: getTypeColor(s.subject_type) + '20' }]}>
                <Ionicons name="book-outline" size={20} color={getTypeColor(s.subject_type)} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subjectName} numberOfLines={1}>{s.name}</Text>
                <Text style={[styles.subjectCode, { color: primaryColor }]}>{s.code}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="school-outline" size={12} color={NEU.textMuted} />
                  <Text style={styles.metaText}>{s.section_name}</Text>
                </View>
              </View>
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(s.subject_type) + '20' }]}>
                <Text style={[styles.typeText, { color: getTypeColor(s.subject_type) }]}>{s.subject_type}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={NEU.textFaint} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.infoCard}>
            <View style={styles.emptyBox}>
              <Ionicons name="book-outline" size={48} color={NEU.textMuted} />
              <Text style={styles.emptyTitle}>No subjects assigned</Text>
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
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 16, paddingHorizontal: 20, marginBottom: 20, borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  summaryIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryLabel: { fontSize: 11, color: NEU.textFaint, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  summaryValue: { fontSize: 26, fontWeight: '800', color: NEU.text, letterSpacing: -0.5, marginTop: 2 },
  subjectCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 10, borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  subjectIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  subjectName: { fontSize: 14, fontWeight: '600', color: NEU.text },
  subjectCode: { fontSize: 11, marginTop: 2, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { fontSize: 11, color: NEU.textMuted },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typeText: { fontSize: 10, fontWeight: '700' },
  infoCard: {
    paddingVertical: 8, paddingHorizontal: 20, marginBottom: 20, borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 13, color: NEU.textMuted, marginTop: 12, textAlign: 'center' },
});