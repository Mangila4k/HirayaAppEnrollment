import { supabase } from '@/lib/supabase/client';
import { spacing, typography } from '@/styles';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.78, 320);

const THEME = {
  royalBlue: '#1E3A8A',
  royalBlueSoft: 'rgba(30,58,138,0.12)',
  yellow: '#F5C518',
  white: '#FFFFFF',
  offWhite: '#F5F7FA',
  lightGray: '#E5EAF2',
  gray: '#8A94A6',
  darkGray: '#4A5568',
  black: '#1A202C',
  danger: '#EF4444',
};

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function StudentSidebar({ visible, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [studentName, setStudentName] = useState('Student');
  const [studentInfo, setStudentInfo] = useState('');

  // ===== Load real student data from Supabase on open =====
  useEffect(() => {
    if (!visible) return;

    const loadStudent = async () => {
      try {
        const email = await AsyncStorage.getItem('userEmail');
        if (!email) return;

        const { data: userData } = await supabase
          .from('users')
          .select('student_id, first_name, last_name')
          .eq('email', email)
          .maybeSingle();

        let studentData: any = null;

        if (userData?.student_id) {
          const { data } = await supabase
            .from('students')
            .select(`
              id, first_name, last_name, middle_name, suffix,
              grade_level, strand,
              sections:section_id (name)
            `)
            .eq('id', userData.student_id)
            .maybeSingle();
          studentData = data;
        }

        if (!studentData) {
          const { data } = await supabase
            .from('students')
            .select(`
              id, first_name, last_name, middle_name, suffix,
              grade_level, strand,
              sections:section_id (name)
            `)
            .eq('email', email)
            .maybeSingle();
          studentData = data;
        }

        if (!studentData) {
          const cachedName = await AsyncStorage.getItem('studentName');
          const cachedInfo = await AsyncStorage.getItem('studentInfo');
          if (cachedName) setStudentName(cachedName);
          if (cachedInfo) setStudentInfo(cachedInfo);
          return;
        }

        const middle = studentData.middle_name
          ? ` ${studentData.middle_name.charAt(0)}.`
          : '';
        const suffix = studentData.suffix ? ` ${studentData.suffix}` : '';
        const fullName =
          `${studentData.first_name || ''}${middle} ${studentData.last_name || ''}${suffix}`.trim() ||
          'Student';

        const sectionRel = Array.isArray(studentData.sections)
          ? studentData.sections[0]
          : studentData.sections;

        const parts: string[] = [];
        if (studentData.grade_level && studentData.grade_level !== 'N/A') {
          parts.push(studentData.grade_level);
        }
        if (studentData.strand && studentData.strand !== 'N/A') {
          parts.push(studentData.strand);
        }
        if (sectionRel?.name) {
          parts.push(sectionRel.name);
        }

        setStudentName(fullName);
        setStudentInfo(parts.join(' · '));

        await AsyncStorage.setItem('studentName', fullName);
        await AsyncStorage.setItem('studentInfo', parts.join(' · '));
      } catch (err) {
        console.error('Error loading student in sidebar:', err);
      }
    };

    loadStudent();
  }, [visible]);

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 180);
  };

  const handleLogout = () => {
    onClose();
    setTimeout(() => {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                router.replace('/(auth)/login' as any);
                const keys = [
                  'userEmail', 'userId', 'userRole',
                  'parentName', 'parentInfo', 'studentName', 'studentInfo',
                  'teacherName', 'teacherInfo', 'currentUser',
                ];
                for (const key of keys) await AsyncStorage.removeItem(key);
              } catch {
                router.replace('/(auth)/login' as any);
              }
            },
          },
        ],
        { cancelable: true }
      );
    }, 200);
  };

  const getInitials = () => {
    const parts = studentName.split(' ').filter(Boolean);
    if (parts.length === 0) return 'S';
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  const isActive = (route: string) => {
    if (route === '/student') return pathname === '/student' || pathname === '/student/index';
    return pathname.includes(route);
  };

  const NavItem = ({ label, icon, route, color = THEME.black }: any) => {
    const active = isActive(route);
    return (
      <TouchableOpacity
        style={[styles.navItem, active && styles.navItemActive]}
        onPress={() => handleNavigate(route)}
        activeOpacity={0.7}
      >
        <View style={[styles.navIcon, active && styles.navIconActive]}>
          <Ionicons
            name={icon}
            size={20}
            color={active ? THEME.white : (color === THEME.danger ? THEME.danger : THEME.royalBlue)}
          />
        </View>
        <Text style={[styles.navLabel, active && styles.navLabelActive, { color: active ? THEME.white : color }]}>
          {label}
        </Text>
        {active && <View style={styles.activeDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.panel}>
          
          <View style={styles.topSpacer} />

          {/* ===== Scrollable Nav Area ===== */}
          <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
            
            <Text style={styles.sectionTitle}>MAIN MENU</Text>
            <NavItem label="Dashboard" icon="grid" route="/student" />
            <NavItem label="Attendance" icon="calendar" route="/student/attendance" />
            <NavItem label="Requirements" icon="document-text" route="/student/requirements" />

            <Text style={styles.sectionTitle}>ACADEMICS</Text>
            <NavItem label="Assessments" icon="clipboard" route="/student/assessments" />
            <NavItem label="Class Program" icon="time" route="/student/schedule" />
            <NavItem label="My Grades" icon="star" route="/student/grades" />

            <Text style={styles.sectionTitle}>DISCIPLINE & CONDUCT</Text>
            <NavItem label="Guidance & Violations" icon="shield-checkmark" route="/student/violations" />

          </ScrollView>

          {/* ===== Bottom Section (Pinned) ===== */}
          <View style={styles.bottomSection}>
            
            <Text style={styles.sectionTitle}>ACCOUNT</Text>

            {/* Profile & Logout aligned together */}
            <NavItem label="My Profile" icon="person-outline" route="/student/profile" />
            
            <TouchableOpacity style={styles.navItem} onPress={handleLogout} activeOpacity={0.7}>
              <View style={styles.navIcon}>
                <Ionicons name="log-out-outline" size={20} color={THEME.danger} />
              </View>
              <Text style={[styles.navLabel, { color: THEME.danger }]}>Logout</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Student Info */}
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
              <View style={styles.headerTextCol}>
                <Text style={styles.name} numberOfLines={1}>{studentName}</Text>
                {studentInfo ? (
                  <Text style={styles.info} numberOfLines={1}>{studentInfo}</Text>
                ) : null}
              </View>
            </View>

          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: THEME.white,
    paddingBottom: 20,
  },
  topSpacer: {
    paddingTop: 40,
  },
  nav: { flex: 1, paddingTop: spacing.md },
  
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.gray,
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
    paddingHorizontal: spacing.lg,
  },

  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.sm,
    borderRadius: 10,
    marginBottom: 4,
  },
  navItemActive: { backgroundColor: THEME.royalBlue },
  navIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: THEME.royalBlueSoft,
  },
  navIconActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  navLabel: { flex: 1, fontSize: typography.sizes.sm, color: THEME.black, fontWeight: '500' },
  navLabelActive: { color: THEME.white, fontWeight: '700' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: THEME.yellow },

  bottomSection: {
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.lightGray,
    marginVertical: spacing.md,
    marginHorizontal: spacing.md,
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  avatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.royalBlue,
  },
  avatarText: { color: THEME.white, fontSize: 18, fontWeight: '700' },
  name: { fontSize: typography.sizes.md, fontWeight: '700', color: THEME.black },
  info: { fontSize: typography.sizes.xs, marginTop: 2, color: THEME.gray },
});