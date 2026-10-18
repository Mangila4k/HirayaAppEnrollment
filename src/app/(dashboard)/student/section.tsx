import StudentSidebar from '@/components/StudentSidebar';
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

type Classmate = {
  id: string;
  full_name: string;
  lrn: string;
  gender: string;
};

type SectionInfo = {
  id: string;
  name: string;
  grade_level: string;
  strand: string;
  adviser_name: string;
  adviser_email: string;
  adviser_specialization: string;
  room: string;
  student_count: number;
};

const THEME = {
  royalBlue: '#1E3A8A',
  royalBlueDark: '#152C6B',
  yellow: '#F5C518',
  yellowLight: '#FFD84D',
  white: '#FFFFFF',
  offWhite: '#F0F4FA',
  offWhiteDark: '#D6E0F0',
  lightShadow: '#FFFFFF',
  darkShadow: '#B8C5DB',
  gray: '#8A94A6',
  darkGray: '#4A5568',
  black: '#1A202C',
  danger: '#EF4444',
};

export default function StudentSection() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [section, setSection] = useState<SectionInfo | null>(null);
  const [classmates, setClassmates] = useState<Classmate[]>([]);

  useEffect(() => { loadSection(); }, []);

  const loadSection = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) { setLoading(false); return; }

      const { data: userData } = await supabase
        .from('users').select('*').eq('email', email).single();

      if (!userData) { setLoading(false); return; }

      let studentData: any = null;
      if (userData.student_id) {
        const { data } = await supabase
          .from('students').select('id, section_id')
          .eq('id', userData.student_id).maybeSingle();
        studentData = data;
      }

      if (!studentData) {
        const { data } = await supabase
          .from('students').select('id, section_id')
          .eq('email', email).maybeSingle();
        studentData = data;
      }

      if (!studentData?.section_id) { setLoading(false); return; }

      const { data: sectionData } = await supabase
        .from('sections')
        .select(`
          id, name, grade_level, strand, room, adviser_id, adviser_name,
          teachers:adviser_id (
            id, user_id, employee_id, specialization,
            users:user_id (first_name, last_name, email)
          )
        `)
        .eq('id', studentData.section_id)
        .single();

      let adviserName = 'No Adviser';
      let adviserEmail = '';
      let adviserSpecialization = '';

      const teacherRel = sectionData?.teachers
        ? Array.isArray(sectionData.teachers)
          ? sectionData.teachers[0]
          : sectionData.teachers
        : null;

      if (teacherRel) {
        const teacherUser = Array.isArray(teacherRel.users)
          ? teacherRel.users[0]
          : teacherRel.users;
        if (teacherUser) {
          adviserName =
            `${teacherUser.first_name || ''} ${teacherUser.last_name || ''}`.trim() ||
            'No Adviser';
          adviserEmail = teacherUser.email || '';
        }
        adviserSpecialization = teacherRel.specialization || '';
      }

      if ((!adviserName || adviserName === 'No Adviser') && sectionData?.adviser_name) {
        adviserName = sectionData.adviser_name;
      }

      if (sectionData) {
        setSection({
          id: sectionData.id,
          name: sectionData.name || 'Unknown',
          grade_level: sectionData.grade_level || 'N/A',
          strand: sectionData.strand || 'N/A',
          adviser_name: adviserName,
          adviser_email: adviserEmail,
          adviser_specialization: adviserSpecialization,
          room: sectionData.room || 'N/A',
          student_count: 0,
        });
      }

      const { data: classmatesData } = await supabase
        .from('students')
        .select('id, lrn, gender, first_name, last_name, middle_name')
        .eq('section_id', studentData.section_id)
        .order('last_name', { ascending: true });

      if (classmatesData) {
        const list: Classmate[] = classmatesData.map((s: any) => {
          const middle = s.middle_name ? ` ${s.middle_name.charAt(0)}.` : '';
          return {
            id: s.id,
            full_name:
              `${s.first_name || ''}${middle} ${s.last_name || ''}`.trim() || 'Unknown',
            lrn: s.lrn || 'N/A',
            gender: s.gender || 'N/A',
          };
        });
        setClassmates(list);
        setSection((prev) => (prev ? { ...prev, student_count: list.length } : null));
      }
    } catch (error) {
      console.error('Error loading section:', error);
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingOrb}>
            <ActivityIndicator size="small" color={THEME.royalBlue} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.royalBlue} />
          </TouchableOpacity>
          <Text style={styles.title}>My Section</Text>
          <TouchableOpacity onPress={loadSection} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={THEME.royalBlue} />
          </TouchableOpacity>
        </View>

        {section ? (
          <>
            {/* Section card */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionIconContainer}>
                <Ionicons name="school" size={32} color={THEME.white} />
              </View>
              <Text style={styles.sectionName}>{section.name}</Text>
              <Text style={styles.sectionDetails}>
                Grade {section.grade_level}
                {section.strand !== 'N/A' ? ` • ${section.strand}` : ''}
              </Text>

              <View style={styles.sectionMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="location" size={16} color={THEME.royalBlue} />
                  <Text style={styles.metaLabel}>Room</Text>
                  <Text style={styles.metaValue}>{section.room}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="people" size={16} color={THEME.royalBlue} />
                  <Text style={styles.metaLabel}>Students</Text>
                  <Text style={styles.metaValue}>{section.student_count}</Text>
                </View>
              </View>
            </View>

            {/* Adviser card */}
            <View style={styles.adviserCard}>
              <View style={styles.adviserHeader}>
                <Ionicons name="person-circle" size={20} color={THEME.royalBlue} />
                <Text style={styles.adviserTitle}>Class Adviser</Text>
              </View>
              <View style={styles.adviserContent}>
                <View style={styles.adviserAvatar}>
                  <Text style={styles.adviserAvatarText}>
                    {(section.adviser_name || 'N').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.adviserInfo}>
                  <Text style={styles.adviserName}>{section.adviser_name}</Text>
                  {section.adviser_specialization ? (
                    <Text style={styles.adviserSpecialization}>
                      {section.adviser_specialization}
                    </Text>
                  ) : null}
                  {section.adviser_email ? (
                    <Text style={styles.adviserEmail}>{section.adviser_email}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Classmates */}
            <View style={styles.classmatesSection}>
              <Text style={styles.classmatesTitle}>
                Classmates ({classmates.length})
              </Text>
              {classmates.length > 0 ? (
                classmates.map((mate, index) => (
                  <View key={mate.id} style={styles.classmateItem}>
                    <View style={styles.classmateNumber}>
                      <Text style={styles.classmateNumberText}>{index + 1}</Text>
                    </View>
                    <View style={styles.classmateInfo}>
                      <Text style={styles.classmateName}>{mate.full_name}</Text>
                      <Text style={styles.classmateDetails}>LRN: {mate.lrn}</Text>
                    </View>
                    <View style={styles.genderBadge}>
                      <Text style={styles.genderText}>{mate.gender}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.noClassmatesContainer}>
                  <Text style={styles.noClassmatesText}>No classmates yet</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={44} color={THEME.gray} />
            <Text style={styles.emptyText}>You are not enrolled in a section yet</Text>
          </View>
        )}
      </ScrollView>

      {/* ===== SIDEBAR ===== */}
      <StudentSidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.offWhite },
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  loadingOrb: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.offWhite,
    shadowColor: THEME.darkShadow,
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 3,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingTop: 16,
  },

  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.offWhite,
    shadowColor: THEME.darkShadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },
  title: { fontSize: 18, fontWeight: '700', color: THEME.black },

  sectionCard: {
    backgroundColor: THEME.offWhite, borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 16,
    shadowColor: THEME.darkShadow,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },
  sectionIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    backgroundColor: THEME.royalBlue,
    shadowColor: THEME.royalBlueDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  sectionName: { fontSize: 20, fontWeight: '800', color: THEME.black },
  sectionDetails: { fontSize: 13, color: THEME.gray, marginTop: 4 },
  sectionMeta: {
    flexDirection: 'row', marginTop: 24, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: THEME.offWhiteDark,
    width: '100%', justifyContent: 'space-around',
  },
  metaItem: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  metaLabel: { fontSize: 11, color: THEME.gray, marginTop: 4 },
  metaValue: {
    fontSize: 13, fontWeight: '700', color: THEME.black,
    marginTop: 2, textAlign: 'center',
  },

  adviserCard: {
    backgroundColor: THEME.offWhite, borderRadius: 20, padding: 20, marginBottom: 16,
    shadowColor: THEME.darkShadow,
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },
  adviserHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: THEME.offWhiteDark,
  },
  adviserTitle: { fontSize: 15, fontWeight: '700', color: THEME.black },
  adviserContent: { flexDirection: 'row', alignItems: 'center' },

  adviserAvatar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
    backgroundColor: THEME.royalBlue,
    shadowColor: THEME.royalBlueDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  adviserAvatarText: { fontSize: 20, fontWeight: '800', color: THEME.white },
  adviserInfo: { flex: 1 },
  adviserName: { fontSize: 15, fontWeight: '700', color: THEME.black },
  adviserSpecialization: { fontSize: 11, marginTop: 2, fontWeight: '600', color: THEME.royalBlue },
  adviserEmail: { fontSize: 11, color: THEME.gray, marginTop: 2 },

  classmatesSection: { marginBottom: 24 },
  classmatesTitle: {
    fontSize: 15, fontWeight: '700', color: THEME.black,
    marginBottom: 16, paddingHorizontal: 4,
  },

  classmateItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: THEME.offWhite, borderRadius: 16, padding: 16, marginBottom: 10,
    shadowColor: THEME.darkShadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },

  classmateNumber: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
    backgroundColor: THEME.yellow,
    shadowColor: THEME.yellowLight,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 2,
  },
  classmateNumberText: { fontSize: 13, fontWeight: '800', color: THEME.royalBlue },
  classmateInfo: { flex: 1 },
  classmateName: { fontSize: 13, fontWeight: '600', color: THEME.black },
  classmateDetails: { fontSize: 11, color: THEME.gray },

  genderBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    backgroundColor: THEME.royalBlue + '15',
    borderWidth: 1, borderColor: THEME.royalBlue + '30',
  },
  genderText: { fontSize: 11, fontWeight: '700', color: THEME.royalBlue },

  noClassmatesContainer: {
    backgroundColor: THEME.offWhite, borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: THEME.darkShadow,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },
  noClassmatesText: { fontSize: 13, color: THEME.gray },

  emptyContainer: {
    alignItems: 'center', padding: 40,
    backgroundColor: THEME.offWhite, borderRadius: 20,
    shadowColor: THEME.darkShadow,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },
  emptyText: {
    fontSize: 15, color: THEME.darkGray, marginTop: 16,
    textAlign: 'center', fontWeight: '600',
  },
});