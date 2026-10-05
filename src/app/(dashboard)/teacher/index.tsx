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
};

type TeacherInfo = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  department: string;
  employee_id: string;
};

export default function TeacherDashboard() {
  const router = useRouter();
  const { primaryColor, theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    todayClasses: 0,
    pendingGrades: 0,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadTeacherData();
  }, []);

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      // 1. Get email from AsyncStorage
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        setLoading(false);
        return;
      }

      // 2. Fetch user row
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .eq('email', email)
        .maybeSingle();

      if (userError || !userData) {
        setLoading(false);
        return;
      }

      // 3. Fetch teacher row (by user_id, fallback by email)
      let teacherData: any = null;

      const { data: tByUser } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', userData.id)
        .maybeSingle();

      if (tByUser) {
        teacherData = tByUser;
      } else {
        const { data: tByEmail } = await supabase
          .from('teachers')
          .select('*')
          .eq('email', email)
          .maybeSingle();
        teacherData = tByEmail;
      }

      const resolvedTeacherId = teacherData?.id ?? userData.id;

      setTeacher({
        id: resolvedTeacherId,
        user_id: userData.id,
        first_name: teacherData?.first_name || userData.first_name || '',
        last_name: teacherData?.last_name || userData.last_name || '',
        full_name:
          `${teacherData?.first_name || userData.first_name || ''} ${
            teacherData?.last_name || userData.last_name || ''
          }`.trim() || 'Teacher',
        email: userData.email || email,
        department: teacherData?.department || 'General',
        employee_id: teacherData?.employee_id || 'N/A',
      });

      // 4. Fetch schedules — try teacher_id, then fallback to user_id
      let scheds: any[] = [];

      const { data: schedsByTeacherId } = await supabase
        .from('schedules')
        .select('*')
        .eq('teacher_id', resolvedTeacherId);

      if (schedsByTeacherId && schedsByTeacherId.length > 0) {
        scheds = schedsByTeacherId;
      } else {
        const { data: schedsByUserId } = await supabase
          .from('schedules')
          .select('*')
          .eq('teacher_id', userData.id);
        if (schedsByUserId && schedsByUserId.length > 0) {
          scheds = schedsByUserId;
        }
      }

      // 5. Compute today's classes + unique subject/section ids
      const todayLong = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const todayShort = todayLong.slice(0, 3);

      const matchesToday = (d: string | undefined) => {
        if (!d) return false;
        const s = String(d).trim().toLowerCase();
        return (
          s === todayLong.toLowerCase() ||
          s === todayShort.toLowerCase() ||
          s.startsWith(todayShort.toLowerCase())
        );
      };

      const todayClasses = scheds.filter((s: any) => matchesToday(s.day)).length;

      const subjectIds = [
        ...new Set(
          scheds
            .map((s: any) => s.subject_id || s.subjectId || s.sub_id || s.subject)
            .filter(Boolean)
        ),
      ];
      const sectionIds = [
        ...new Set(
          scheds
            .map((s: any) => s.section_id || s.sectionId || s.sec_id || s.section)
            .filter(Boolean)
        ),
      ];

      // 6. Count students across the teacher's sections
      let totalStudents = 0;
      if (sectionIds.length > 0) {
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .in('section_id', sectionIds);
        totalStudents = count || 0;
      }

      // 7. Pending grades estimate
      let pendingGrades = 0;
      if (subjectIds.length > 0 && sectionIds.length > 0 && totalStudents > 0) {
        const { count: recordedCount } = await supabase
          .from('grades')
          .select('*', { count: 'exact', head: true })
          .in('subject_id', subjectIds)
          .in('section_id', sectionIds);

        const expected = totalStudents * subjectIds.length;
        const recorded = recordedCount || 0;
        pendingGrades = Math.max(0, expected - recorded);
      }

      // 8. Commit
      setStats({
        totalClasses: scheds.length,
        totalStudents,
        todayClasses,
        pendingGrades,
      });
    } catch (e) {
      console.error('Teacher dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon, onPress }: any) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.statIconWrap, { backgroundColor: primaryColor + '15' }]}>
        <Ionicons name={icon} size={18} color={primaryColor} />
      </View>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statTitle} numberOfLines={1}>
        {title}
      </Text>
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
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setDrawerOpen(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>{teacher?.first_name || 'Teacher'}</Text>
            <Text style={styles.subGreeting}>{teacher?.department || ''}</Text>
          </View>

          <View style={styles.headerRight}>
            <NotificationBell iconColor={NEU.text} />
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/(dashboard)/teacher/profile' as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="person-outline" size={20} color={NEU.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Card */}
        {teacher && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {teacher.full_name}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Employee ID</Text>
              <Text style={styles.infoValue}>{teacher.employee_id}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Department</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {teacher.department}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {teacher.email}
              </Text>
            </View>
          </View>
        )}

        {/* Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Classes"
              value={stats.totalClasses}
              icon="school-outline"
              onPress={() => router.push('/(dashboard)/teacher/schedule' as any)}
            />
            <StatCard
              title="Today"
              value={stats.todayClasses}
              icon="calendar-outline"
              onPress={() => router.push('/(dashboard)/teacher/schedule' as any)}
            />
            <StatCard
              title="Students"
              value={stats.totalStudents}
              icon="people-outline"
              onPress={() => router.push('/(dashboard)/teacher/subjects' as any)}
            />
            <StatCard
              title="Pending"
              value={stats.pendingGrades}
              icon="clipboard-outline"
              onPress={() => router.push('/(dashboard)/teacher/grades' as any)}
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.statsGrid}>
            <StatCard
              title="Attendance"
              value=""
              icon="checkbox-outline"
              onPress={() => router.push('/(dashboard)/teacher/attendance' as any)}
            />
            <StatCard
              title="Face Attendance"
              value=""
              icon="camera-outline"
              onPress={() => router.push('/(dashboard)/teacher/face-attendance' as any)}
            />
          </View>
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
    shadowColor: NEU.lightShadow, shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 6,
  },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 20,
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
    borderRightWidth: 1, borderBottomWidth: 1,
    borderRightColor: 'rgba(163,177,198,0.4)',
    borderBottomColor: 'rgba(163,177,198,0.4)',
  },
  greeting: { fontSize: 16, fontWeight: '700', color: NEU.text, letterSpacing: -0.2 },
  subGreeting: { fontSize: 12, color: NEU.textMuted, marginTop: 2, letterSpacing: 0.2 },

  infoCard: {
    paddingVertical: 8, paddingHorizontal: 20, marginBottom: 28,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 14,
  },
  infoLabel: { fontSize: 13, color: NEU.textMuted, letterSpacing: 0.3 },
  infoValue: {
    fontSize: 13, fontWeight: '600', color: NEU.text,
    flex: 1, textAlign: 'right', marginLeft: 16,
  },
  divider: { height: 1, backgroundColor: NEU.bgDark, opacity: 0.5 },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: NEU.textFaint,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 16, paddingHorizontal: 4,
  },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: 16,
  },
  statCard: {
    width: '47%', paddingVertical: 20, paddingHorizontal: 16,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  statIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  statNumber: { fontSize: 26, fontWeight: '800', color: NEU.text, letterSpacing: -0.5 },
  statTitle: { fontSize: 12, color: NEU.textMuted, letterSpacing: 0.3, marginTop: 4, fontWeight: '500' },
});