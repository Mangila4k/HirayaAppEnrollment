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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NEU = {
  bg: '#E8EDF2',
  bgDark: '#D1D9E6',
  lightShadow: '#FFFFFF',
  darkShadow: '#A3B1C6',
  text: '#2E3A4D',
  textMuted: '#7A8699',
  textFaint: '#A0ACBE',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
};

export default function TeacherDashboard() {
  const router = useRouter();
  const { primaryColor, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState('Teacher');
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSections: 0,
    totalSubjects: 0,
    todayClasses: 0,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;

      // 1. Fetch Teacher user row
      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('email', email)
        .maybeSingle();

      if (!userData) return;
      setTeacherName(`${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Teacher');

      // 2. Fetch Teacher record
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userData.id)
        .maybeSingle();

      if (!teacherData) return;
      const teacherId = teacherData.id;

      // 3. Fetch Teacher schedules
      const { data: schedules } = await supabase
        .from('schedules')
        .select('*')
        .eq('teacher_id', teacherId);

      if (!schedules || schedules.length === 0) {
        setStats({ totalStudents: 0, totalSections: 0, totalSubjects: 0, todayClasses: 0 });
        return;
      }

      // Compute today's classes
      const todayLong = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const todayShort = todayLong.slice(0, 3);
      const matchesToday = (d: string | undefined) => {
        if (!d) return false;
        const s = String(d).trim().toLowerCase();
        return s === todayLong.toLowerCase() || s === todayShort.toLowerCase() || s.startsWith(todayShort.toLowerCase());
      };
      const todayClasses = schedules.filter((s: any) => matchesToday(s.day)).length;

      // Extract unique Section IDs and Subject IDs
      const sectionIds = [...new Set(schedules.map((s: any) => s.section_id).filter(Boolean))];
      const subjectIds = [...new Set(schedules.map((s: any) => s.subject_id).filter(Boolean))];

      // Count students belonging to those sections
      let totalStudents = 0;
      if (sectionIds.length > 0) {
        const { count } = await supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .in('section_id', sectionIds);
        totalStudents = count || 0;
      }

      setStats({
        totalStudents,
        totalSections: sectionIds.length,
        totalSubjects: subjectIds.length,
        todayClasses,
      });

    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, onPress }: any) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.statIconWrap, { backgroundColor: primaryColor + '15' }]}>
        <Ionicons name={icon} size={20} color={primaryColor} />
      </View>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statTitle} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );

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
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>{teacherName}</Text>
            <Text style={styles.subGreeting}>Teacher Portal</Text>
          </View>
          <View style={styles.headerRight}>
            <NotificationBell iconColor={NEU.text} />
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(dashboard)/teacher/profile')}>
              <Ionicons name="person-outline" size={20} color={NEU.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon="people-outline"
            onPress={() => router.push('/(dashboard)/teacher/attendance')}
          />
          <StatCard
            title="Sections Handled"
            value={stats.totalSections}
            icon="school-outline"
            onPress={() => router.push('/(dashboard)/teacher/subjects')}
          />
          <StatCard
            title="Subjects Assigned"
            value={stats.totalSubjects}
            icon="book-outline"
            onPress={() => router.push('/(dashboard)/teacher/subjects')}
          />
          <StatCard
            title="Today's Classes"
            value={stats.todayClasses}
            icon="time-outline"
            onPress={() => router.push('/(dashboard)/teacher/schedule')}
          />
        </View>
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
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 20,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  greeting: { fontSize: 16, fontWeight: '700', color: NEU.text },
  subGreeting: { fontSize: 12, color: NEU.textMuted, marginTop: 2 },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 20 },
  statCard: {
    width: '47%', paddingVertical: 20, paddingHorizontal: 16, borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
  },
  statIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statNumber: { fontSize: 26, fontWeight: '800', color: NEU.text },
  statTitle: { fontSize: 12, color: NEU.textMuted, fontWeight: '600', marginTop: 4 },
});