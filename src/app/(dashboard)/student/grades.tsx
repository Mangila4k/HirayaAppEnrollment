import StudentSidebar from '@/components/StudentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ===== THEME =====
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
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

type Subject = {
  id: string;
  name: string;
  code: string;
};

type GradeData = {
  [subjectId: string]: {
    [quarter: number]: number;
  };
};

type EnrollmentInfo = {
  grade_level: string;
  strand: string;
  school_year: string;
  status: string;
  section_name: string;
};

// Default subjects to match the image layout (Junior High)
const DEFAULT_SUBJECTS = [
  'Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan (AP)',
  'Edukasyon sa Pagpapakatao (EsP)', 'Edukasyong Pantahanan at Pangkabuhayan (EPP)',
  'MAPEH', '*Music', '*Arts', '*Physical Education', '*Health', 'ALIVE'
];

export default function StudentGrades() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [student, setStudent] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentInfo | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradesData, setGradesData] = useState<GradeData>({});

  useEffect(() => {
    loadGradesData();
  }, []);

  const loadGradesData = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error('No user email found');

      // ===== 1. Fetch Student =====
      let studentData: any = null;
      const { data: userData } = await supabase
        .from('users').select('student_id').eq('email', email).maybeSingle();

      if (userData?.student_id) {
        const { data } = await supabase.from('students').select('*').eq('id', userData.student_id).maybeSingle();
        studentData = data;
      }
      if (!studentData) {
        const { data } = await supabase.from('students').select('*').eq('email', email).maybeSingle();
        studentData = data;
      }

      if (!studentData) throw new Error('Student record not found');
      setStudent(studentData);

      // ===== 2. Fetch Enrollment (fallback for school year / status) =====
      let enrollmentData: any = null;
      const { data: eRows } = await supabase
        .from('enrollments').select('*')
        .or(`email.eq.${email},student_id.eq.${studentData.id}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (eRows && eRows.length > 0) enrollmentData = eRows[0];

      // ===== 3. GRADE LEVEL & STRAND come from the students table =====
      const gradeLevel = studentData.grade_level || enrollmentData?.grade_level || 'Grade 8';
      const strand     = studentData.strand      || enrollmentData?.strand      || 'N/A';

      // ===== 4. SECTION comes from the sections table =====
      // Try multiple possible FK column names on the students row.
      let sectionName = 'N/A';
      const sectionId =
        studentData.section_id ||
        studentData.sectionId  ||
        studentData.section    ||
        null;

      if (sectionId) {
        const { data: sectionRow } = await supabase
          .from('sections')
          .select('*')
          .eq('id', sectionId)
          .maybeSingle();

        if (sectionRow) {
          sectionName =
            sectionRow.name ||
            sectionRow.section_name ||
            sectionRow.section ||
            'N/A';
        }
      } else if (studentData.section_name) {
        // If the student row already stores the section name directly
        sectionName = studentData.section_name;
      } else if (enrollmentData?.section_name) {
        sectionName = enrollmentData.section_name;
      }

      const schoolYear = enrollmentData?.school_year || '2025-2026';
      const status = enrollmentData?.status
        ? (enrollmentData.status.charAt(0).toUpperCase() + enrollmentData.status.slice(1))
        : (studentData.documents_status === 'complete' ? 'Enrolled' : 'Pending');

      setEnrollment({
        grade_level: gradeLevel,
        strand,
        school_year: schoolYear,
        status,
        section_name: sectionName,
      });

      // ===== 5. Fetch Subjects =====
      let subjectList: Subject[] = [];
      const { data: dbSubjects } = await supabase.from('subjects').select('*');

      if (dbSubjects && dbSubjects.length > 0) {
        subjectList = dbSubjects.filter((s: any) => {
          const gradeMatch = s.grade_level === gradeLevel || s.grade_level?.includes(gradeLevel.replace('Grade ', ''));
          const strandMatch = !s.strand || s.strand === strand || s.strand === 'General' || strand === 'N/A';
          return gradeMatch && strandMatch;
        }).map((s: any) => ({
          id: s.id,
          name: s.name || s.subject_name || 'Subject',
          code: s.code || 'SUB101'
        }));
      }

      // Fallback if DB is empty
      if (subjectList.length === 0) {
        subjectList = DEFAULT_SUBJECTS.map((name, idx) => ({
          id: `sub_${idx + 1}`,
          name,
          code: `SUB${101 + idx}`
        }));
      }

      setSubjects(subjectList);

      // ===== 6. Fetch Grades (STRICTLY FROM DATABASE) =====
      const gradeMap: GradeData = {};
      const { data: dbGrades } = await supabase
        .from('grades').select('*').eq('student_id', studentData.id);

      if (dbGrades && dbGrades.length > 0) {
        dbGrades.forEach((g: any) => {
          if (!gradeMap[g.subject_id]) gradeMap[g.subject_id] = {};
          gradeMap[g.subject_id][g.quarter] = parseFloat(g.grade);
        });
      }

      setGradesData(gradeMap);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Failed to load grades');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadGradesData();
  };

  // ===== REMARKS: PASSED / FAILED ONLY =====
  const getRemarks = (grade: number) => {
    if (grade >= 75) return 'Passed';
    return 'Failed';
  };

  // ===== CALCULATIONS =====
  const generalAverage = useMemo(() => {
    let total = 0;
    let count = 0;

    subjects.forEach(sub => {
      const grades = gradesData[sub.id] || {};
      const q1 = grades[1] || 0;
      const q2 = grades[2] || 0;
      const q3 = grades[3] || 0;
      const q4 = grades[4] || 0;

      if (q1 > 0 && q2 > 0 && q3 > 0 && q4 > 0) {
        const final = (q1 + q2 + q3 + q4) / 4;
        total += final;
        count++;
      }
    });

    return count > 0 ? (total / count).toFixed(2) : '—';
  }, [subjects, gradesData]);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.royalBlue} />}
      >
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.royalBlue} />
          </TouchableOpacity>
          <Text style={styles.title}>My Grades</Text>
          <TouchableOpacity onPress={loadGradesData} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={THEME.royalBlue} />
          </TouchableOpacity>
        </View>

        {/* ===== ENROLLMENT INFO ===== */}
        {enrollment && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Student:</Text>
              <Text style={styles.infoVal}>{student?.first_name} {student?.last_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Grade & Section:</Text>
              <Text style={styles.infoVal}>
                {enrollment.grade_level} ({enrollment.section_name})
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Strand:</Text>
              <Text style={styles.infoVal}>{enrollment.strand}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>School Year:</Text>
              <Text style={styles.infoVal}>{enrollment.school_year}</Text>
            </View>
          </View>
        )}

        {/* ===== REPORT CARD CONTAINER ===== */}
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>LEARNING PROGRESS AND ACHIEVEMENT</Text>

          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={[styles.cell, styles.cellHeader, { flex: 2.2 }]}>
                <Text style={styles.headerText}>Learning Areas</Text>
              </View>
              <View style={[styles.cell, styles.cellHeader, { flex: 1.8 }]}>
                <Text style={styles.headerText}>QUARTER</Text>
                <View style={styles.quarterHeaderRow}>
                  <View style={[styles.quarterHeadCell, { borderLeftWidth: 0 }]}><Text style={styles.quarterHeadText}>1</Text></View>
                  <View style={styles.quarterHeadCell}><Text style={styles.quarterHeadText}>2</Text></View>
                  <View style={styles.quarterHeadCell}><Text style={styles.quarterHeadText}>3</Text></View>
                  <View style={styles.quarterHeadCell}><Text style={styles.quarterHeadText}>4</Text></View>
                </View>
              </View>
              <View style={[styles.cell, styles.cellHeader, { flex: 1 }]}>
                <Text style={styles.headerText}>Final{'\n'}Grade</Text>
              </View>
              <View style={[styles.cell, styles.cellHeader, { flex: 1.2, borderRightWidth: 0 }]}>
                <Text style={styles.headerText}>Remarks</Text>
              </View>
            </View>

            {/* Table Body */}
            {subjects.map((sub) => {
              const grades = gradesData[sub.id] || {};
              const q1 = grades[1] || 0;
              const q2 = grades[2] || 0;
              const q3 = grades[3] || 0;
              const q4 = grades[4] || 0;

              const hasAllQuarters = q1 > 0 && q2 > 0 && q3 > 0 && q4 > 0;
              const final = hasAllQuarters ? ((q1 + q2 + q3 + q4) / 4).toFixed(1) : '—';
              const remark = hasAllQuarters ? getRemarks(Number(final)) : '—';

              return (
                <View key={sub.id} style={styles.tableRow}>
                  <View style={[styles.cell, { flex: 2.2, alignItems: 'flex-start', paddingLeft: 6 }]}>
                    <Text style={styles.subjectText} numberOfLines={2}>{sub.name}</Text>
                  </View>

                  <View style={[styles.cell, { flex: 1.8, flexDirection: 'row', padding: 0 }]}>
                    <View style={[styles.qCell, { borderLeftWidth: 0 }]}><Text style={styles.qText}>{q1 || '-'}</Text></View>
                    <View style={styles.qCell}><Text style={styles.qText}>{q2 || '-'}</Text></View>
                    <View style={styles.qCell}><Text style={styles.qText}>{q3 || '-'}</Text></View>
                    <View style={styles.qCell}><Text style={styles.qText}>{q4 || '-'}</Text></View>
                  </View>

                  <View style={[styles.cell, { flex: 1 }]}>
                    <Text style={styles.finalText}>{final}</Text>
                  </View>

                  <View style={[styles.cell, { flex: 1.2, padding: 4, borderRightWidth: 0 }]}>
                    <Text style={styles.remarkText} numberOfLines={2}>
                      {remark}
                    </Text>
                  </View>
                </View>
              );
            })}

            {/* General Average Row */}
            <View style={[styles.tableRow, styles.tableRowFooter, { borderBottomWidth: 0 }]}>
              <View style={[styles.cell, { flex: 4, alignItems: 'flex-end', paddingRight: 10 }]}>
                <Text style={styles.generalAvgLabel}>General Average</Text>
              </View>
              <View style={[styles.cell, { flex: 1 }]}>
                <Text style={styles.generalAvgValue}>{generalAverage}</Text>
              </View>
              <View style={[styles.cell, { flex: 1.2, borderRightWidth: 0 }]}>
                <Text style={styles.generalAvgRemarks}>
                  {generalAverage !== '—' ? getRemarks(Number(generalAverage)) : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>

      <StudentSidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

// ==================================================
// STYLES
// ==================================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.offWhite },
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingOrb: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.offWhite,
    shadowColor: THEME.darkShadow, shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 3,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingTop: 12,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.white,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  title: { fontSize: 18, fontWeight: '700', color: THEME.black },

  // Info Card
  infoCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { fontSize: 12, color: THEME.gray, fontWeight: '600' },
  infoVal: { fontSize: 13, color: THEME.black, fontWeight: '700' },

  // Report Card Table
  reportCard: {
    backgroundColor: THEME.white,
    borderRadius: 12,
    borderWidth: 2, borderColor: '#000',
    overflow: 'hidden',
    width: '100%',
  },
  reportTitle: {
    fontSize: 13, fontWeight: '800', color: '#000',
    textAlign: 'center', paddingVertical: 10, paddingHorizontal: 6,
    backgroundColor: '#F8F9FA', borderBottomWidth: 2, borderBottomColor: '#000',
  },
  table: { width: '100%' },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderBottomWidth: 2, borderBottomColor: '#000',
  },
  cellHeader: {
    paddingVertical: 6, paddingHorizontal: 2,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: '#000',
  },
  headerText: { fontSize: 10, fontWeight: '800', color: '#000', textAlign: 'center' },

  quarterHeaderRow: {
    flexDirection: 'row', width: '100%', marginTop: 4,
  },
  quarterHeadCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: 1, borderLeftColor: '#000',
  },
  quarterHeadText: { fontSize: 9, fontWeight: '800', color: '#000' },

  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#000',
  },
  cell: {
    paddingVertical: 6, paddingHorizontal: 2,
    alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: '#000',
  },
  subjectText: { fontSize: 10, fontWeight: '600', color: '#000' },

  qCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: 1, borderLeftColor: '#000',
    paddingVertical: 6,
  },
  qText: { fontSize: 10, fontWeight: '600', color: '#000' },

  finalText: { fontSize: 11, fontWeight: '800', color: '#000' },
  remarkText: { fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 12, color: '#000' },

  tableRowFooter: {
    backgroundColor: '#F8F9FA',
  },
  generalAvgLabel: { fontSize: 11, fontWeight: '800', color: '#000' },
  generalAvgValue: { fontSize: 13, fontWeight: '800', color: '#000' },
  generalAvgRemarks: { fontSize: 9, fontWeight: '700', color: '#000', textAlign: 'center' },
});