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
  TextInput,
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
  excused: '#8B5CF6',
};

type AttendanceRecord = {
  id: string;
  date: string;
  time_in?: string;
  time_out?: string;
  status: 'Present' | 'Late' | 'Absent' | 'Excused';
  remarks?: string;
  teacher_name?: string;
};

type StudentInfo = {
  lrn: string;
  grade_level: string;
  strand: string;
  section_name: string;
  school_year: string;
  enrollment_status: string;
};

export default function StudentAttendance() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  
  // Filters
  const [monthFilter, setMonthFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAttendanceData();
  }, []);

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error('No user email found in session.');

      // 1. Fetch Student Record
      let studentData: any = null;
      
      // Try finding by email in the users table first
      const { data: userData } = await supabase
        .from('users').select('student_id').eq('email', email).maybeSingle();

      if (userData?.student_id) {
        const { data } = await supabase.from('students').select('*').eq('id', userData.student_id).maybeSingle();
        studentData = data;
      }
      
      // Fallback: find by email directly in students table
      if (!studentData) {
        const { data } = await supabase.from('students').select('*').eq('email', email).maybeSingle();
        studentData = data;
      }

      if (!studentData) throw new Error('Student record not found.');

      // 2. Fetch Enrollment Info (for School Year and Grade)
      let enrollment: any = null;
      const { data: eRows } = await supabase
        .from('enrollments').select('*')
        .or(`email.eq.${email},student_id.eq.${studentData.id}`)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (eRows && eRows.length > 0) enrollment = eRows[0];

      // 3. Fetch Section Name
      let secName = 'Unassigned';
      if (studentData.section_id) {
        const { data: sec } = await supabase
          .from('sections')
          .select('name')
          .eq('id', studentData.section_id)
          .maybeSingle();
        if (sec) secName = sec.name;
      }

      setStudentInfo({
        lrn: studentData.lrn || 'N/A',
        grade_level: enrollment?.grade_level || studentData.grade_level || 'Grade 11',
        strand: enrollment?.strand || studentData.strand || 'N/A',
        section_name: secName,
        school_year: enrollment?.school_year || '2025-2026',
        enrollment_status: studentData.documents_status === 'complete' ? 'Enrolled' : 'Pending',
      });

      // 4. Fetch Attendance Records (Matching the Teacher Web App)
      const { data: attData, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentData.id)
        .order('date', { ascending: false });

      if (attError) {
        console.warn('Attendance fetch error:', attError.message);
      }

      if (attData) {
        // Normalize status capitalization
        const normalized = attData.map((r: any) => ({
          id: r.id,
          date: r.date,
          time_in: r.time_in || '—',
          time_out: r.time_out || '—',
          status: (r.status || 'Present').charAt(0).toUpperCase() + (r.status || 'Present').slice(1).toLowerCase(),
          remarks: r.remarks || '',
          teacher_name: r.teacher_name || null
        }));
        
        setRecords(normalized);
      } else {
        setRecords([]);
      }

    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAttendanceData();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const getDayOfWeek = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long' });
    } catch { return ''; }
  };

  // ===== STATS CALCULATION =====
  const stats = useMemo(() => {
    const total = records.length;
    let present = 0, late = 0, absent = 0, excused = 0;

    records.forEach(r => {
      const st = (r.status || '').toLowerCase();
      if (st === 'present') present++;
      else if (st === 'late') late++;
      else if (st === 'absent') absent++;
      else if (st === 'excused') excused++;
    });

    // Standard Attendance Rate: (Present + Late + Excused) / Total Days
    const attended = present + late + excused;
    const rate = total > 0 ? (attended / total) * 100 : 0;

    return { total, present, late, absent, excused, attended, rate };
  }, [records]);

  // ===== TODAY'S STATUS =====
  const todayStatus = useMemo(() => {
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    if (isWeekend) {
      return { label: 'Weekend (No Classes)', status: 'Weekend', remarks: 'No classes scheduled on weekends.', color: THEME.info };
    }

    const todayStr = now.toISOString().split('T')[0];
    const todayRec = records.find(r => r.date === todayStr);

    if (!todayRec) {
      return { label: 'Not Yet Recorded', status: 'Pending', remarks: 'Your teacher has not recorded attendance for today yet.', color: THEME.gray };
    }

    return {
      label: todayRec.status,
      status: todayRec.status,
      remarks: todayRec.remarks || 'Present in class.',
      color: todayRec.status === 'Present' ? THEME.success : 
             todayRec.status === 'Late' ? THEME.warning :
             todayRec.status === 'Excused' ? THEME.excused : THEME.danger
    };
  }, [records]);

  // ===== FILTERING =====
  const filteredRecords = useMemo(() => {
    const currentMonthIdx = new Date().getMonth();
    
    return records.filter(r => {
      const d = new Date(r.date + 'T00:00:00');
      const rMonth = isNaN(d.getTime()) ? -1 : d.getMonth();

      // Month Filter
      if (monthFilter === 'current' && rMonth !== currentMonthIdx) return false;
      if (monthFilter !== 'all' && monthFilter !== 'current' && rMonth !== parseInt(monthFilter)) return false;

      // Status Filter
      if (statusFilter !== 'all' && (r.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const hay = `${formatDate(r.date)} ${getDayOfWeek(r.date)} ${r.status} ${r.remarks || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [records, monthFilter, statusFilter, searchQuery]);

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
          <Text style={styles.title}>My Attendance</Text>
          <TouchableOpacity onPress={loadAttendanceData} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={THEME.royalBlue} />
          </TouchableOpacity>
        </View>

        {/* ===== ENROLLMENT INFO CARD ===== */}
        {studentInfo && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="school" size={20} color={THEME.royalBlue} />
              <Text style={styles.infoTitle}>Current Enrollment</Text>
            </View>
            <View style={styles.infoGrid}>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Grade</Text>
                <Text style={styles.infoVal}>{studentInfo.grade_level}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Strand</Text>
                <Text style={styles.infoVal}>{studentInfo.strand}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Section</Text>
                <Text style={styles.infoVal}>{studentInfo.section_name}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>S.Y.</Text>
                <Text style={styles.infoVal}>{studentInfo.school_year}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ===== STATS GRID ===== */}
        <View style={styles.statsGrid}>
          {/* Attendance Rate */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>RATE</Text>
              <Ionicons name="pie-chart" size={16} color={THEME.success} />
            </View>
            <Text style={styles.statNum}>{stats.rate.toFixed(1)}%</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(100, stats.rate)}%` }]} />
            </View>
            <Text style={styles.statSub}>{stats.attended}/{stats.total} Days</Text>
          </View>

          {/* Present */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>PRESENT</Text>
              <Ionicons name="checkmark-circle" size={16} color={THEME.success} />
            </View>
            <Text style={[styles.statNum, { color: THEME.success }]}>{stats.present}</Text>
            <Text style={styles.statSub}>On-time</Text>
          </View>

          {/* Late */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>LATE</Text>
              <Ionicons name="time" size={16} color={THEME.warning} />
            </View>
            <Text style={[styles.statNum, { color: THEME.warning }]}>{stats.late}</Text>
            <Text style={styles.statSub}>Arrivals</Text>
          </View>

          {/* Absences / Excused */}
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>ABSENT</Text>
              <Ionicons name="close-circle" size={16} color={THEME.danger} />
            </View>
            <Text style={[styles.statNum, { color: THEME.danger }]}>{stats.absent + stats.excused}</Text>
            <Text style={styles.statSub}>{stats.absent} A / {stats.excused} E</Text>
          </View>
        </View>

        {/* ===== TODAY'S STATUS CARD ===== */}
        <View style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.todayIconWrap}>
                <Ionicons name="calendar" size={20} color={THEME.royalBlue} />
              </View>
              <View>
                <Text style={styles.todayTitle}>Today's Status</Text>
                <Text style={styles.todaySub}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
              </View>
            </View>
            <View style={[styles.todayBadge, { backgroundColor: todayStatus.color + '20' }]}>
              <Text style={[styles.todayBadgeText, { color: todayStatus.color }]}>{todayStatus.status}</Text>
            </View>
          </View>
          <View style={styles.todayBody}>
            <Text style={styles.todayRemarksLabel}>Remarks / Notes:</Text>
            <Text style={styles.todayRemarksText}>{todayStatus.remarks}</Text>
          </View>
        </View>

        {/* ===== FILTERS ===== */}
        <Text style={styles.sectionTitle}>Attendance Records</Text>
        
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {[
              { key: 'all', label: 'All Months' },
              { key: 'current', label: 'Current' },
              { key: '0', label: 'Jan' }, { key: '1', label: 'Feb' }, { key: '2', label: 'Mar' },
              { key: '3', label: 'Apr' }, { key: '4', label: 'May' }, { key: '5', label: 'Jun' },
              { key: '6', label: 'Jul' }, { key: '7', label: 'Aug' }, { key: '8', label: 'Sep' },
              { key: '9', label: 'Oct' }, { key: '10', label: 'Nov' }, { key: '11', label: 'Dec' },
            ].map(m => (
              <TouchableOpacity
                key={m.key}
                style={[styles.filterChip, monthFilter === m.key && styles.filterChipActive]}
                onPress={() => setMonthFilter(m.key)}
              >
                <Text style={[styles.filterChipText, monthFilter === m.key && styles.filterChipTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {['all', 'Present', 'Late', 'Absent', 'Excused'].map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                  {s === 'all' ? 'All Statuses' : s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={THEME.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search date, day, or remarks..."
            placeholderTextColor={THEME.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* ===== RECORDS LIST ===== */}
        {filteredRecords.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={44} color={THEME.gray} />
            <Text style={styles.emptyText}>No Records Found</Text>
            <Text style={styles.emptySub}>No attendance logs match your current filters.</Text>
          </View>
        ) : (
          filteredRecords.map((rec, index) => {
            const st = (rec.status || '').toLowerCase();
            const color = st === 'present' ? THEME.success : (st === 'late' ? THEME.warning : (st === 'excused' ? THEME.excused : THEME.danger));
            const icon = st === 'present' ? 'checkmark-circle' : (st === 'late' ? 'time' : (st === 'excused' ? 'medical' : 'close-circle'));

            return (
              <View key={rec.id || index} style={styles.recordCard}>
                <View style={styles.recordLeft}>
                  <View style={[styles.statusIconWrap, { backgroundColor: color + '20' }]}>
                    <Ionicons name={icon as any} size={18} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordDate}>{formatDate(rec.date)}</Text>
                    <Text style={styles.recordDay}>{getDayOfWeek(rec.date)}</Text>
                  </View>
                </View>
                <View style={styles.recordRight}>
                  <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.statusBadgeText, { color }]}>{rec.status}</Text>
                  </View>
                  <Text style={styles.recordRemarks} numberOfLines={1}>{rec.remarks || '—'}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ===== SIDEBAR ===== */}
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
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: THEME.black },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoCol: { width: '47%' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: THEME.gray, textTransform: 'uppercase' },
  infoVal: { fontSize: 13, fontWeight: '600', color: THEME.black, marginTop: 2 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    width: '47%', backgroundColor: THEME.white, padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statLabel: { fontSize: 10, fontWeight: '700', color: THEME.gray, letterSpacing: 0.5 },
  statNum: { fontSize: 20, fontWeight: '800', color: THEME.royalBlue },
  statSub: { fontSize: 10, color: THEME.gray, marginTop: 2 },
  progressBarBg: { height: 4, backgroundColor: THEME.offWhiteDark, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: THEME.success, borderRadius: 2 },

  // Today Card
  todayCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: THEME.offWhiteDark, paddingBottom: 12, marginBottom: 12 },
  todayIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: THEME.royalBlue + '10', alignItems: 'center', justifyContent: 'center' },
  todayTitle: { fontSize: 14, fontWeight: '700', color: THEME.black },
  todaySub: { fontSize: 11, color: THEME.gray },
  todayBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  todayBadgeText: { fontSize: 11, fontWeight: '700' },
  todayBody: { paddingTop: 4 },
  todayRemarksLabel: { fontSize: 11, fontWeight: '600', color: THEME.gray, marginBottom: 4 },
  todayRemarksText: { fontSize: 13, color: THEME.darkGray, fontStyle: 'italic' },

  // Section Title & Filters
  sectionTitle: { fontSize: 16, fontWeight: '800', color: THEME.black, marginBottom: 12 },
  filterRow: { marginBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: THEME.white, borderWidth: 1, borderColor: THEME.offWhiteDark, marginRight: 8 },
  filterChipActive: { backgroundColor: THEME.royalBlue, borderColor: THEME.royalBlue },
  filterChipText: { fontSize: 11, fontWeight: '600', color: THEME.darkGray },
  filterChipTextActive: { color: THEME.white },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: THEME.white,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  searchInput: { flex: 1, fontSize: 13, color: THEME.black },

  // Records
  recordCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: THEME.white, borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  recordLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  recordDate: { fontSize: 13, fontWeight: '700', color: THEME.black },
  recordDay: { fontSize: 11, color: THEME.gray },
  recordRight: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 4 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  recordRemarks: { fontSize: 10, color: THEME.gray, maxWidth: 120 },

  // Empty
  emptyContainer: {
    alignItems: 'center', padding: 40, backgroundColor: THEME.white, borderRadius: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  emptyText: { fontSize: 16, fontWeight: '700', color: THEME.black, marginTop: 12 },
  emptySub: { fontSize: 13, color: THEME.gray, textAlign: 'center', marginTop: 4 },
});