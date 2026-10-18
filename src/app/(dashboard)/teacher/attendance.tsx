import { useTheme } from '@/app/_context/themecontext';
import TeacherSidebar from '@/components/TeacherSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ============================================
// TIME CONSTANTS
// ============================================
const LATE_CUTOFF_HOUR = 7;
const LATE_CUTOFF_MINUTE = 30;

const NEU = {
  bg: '#E8EDF2',
  bgDark: '#D1D9E6',
  lightShadow: '#FFFFFF',
  darkShadow: '#A3B1C6',
  text: '#2E3A4D',
  textMuted: '#7A8699',
  textFaint: '#A0ACBE',
  accent: '#4C6FFF',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

type Student = {
  id: string;
  full_name: string;
  lrn: string;
  id_number: string;
  grade_level: string;
  section: string;
  strand: string;
  parent_name: string;
  parent_contact: string;
  photo_url: string;
  email: string;
};

type ScannedRecord = {
  id: string;
  studentId: string;
  name: string;
  lrn: string;
  idNo: string;
  grade: string;
  section: string;
  strand: string;
  time: string;
  date: string;
  status: 'Present' | 'Late' | 'Duplicate';
  mode: 'time_in' | 'time_out';
};

// ============================================
// UTILITIES
// ============================================
const getTodayDateString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getCurrentTimeString = (): string => {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

const parseStudentPayload = (rawText: string): { lrn: string | null; idNumber: string | null; rawText: string } => {
  const text = (rawText || '').trim();
  let lrn = '';
  let idNumber = '';

  if (text.includes('?') && (text.includes('lrn=') || text.includes('id='))) {
    try {
      const qs = text.split('?')[1] || '';
      const params = new URLSearchParams(qs);
      lrn = params.get('lrn') || '';
      idNumber = params.get('id') || '';
    } catch {}
  } else if (text.includes('|') && (text.includes('LRN:') || text.includes('ID:'))) {
    text.split('|').forEach((p) => {
      const [k, ...v] = p.split(':');
      const key = (k || '').trim().toUpperCase();
      const val = v.join(':').trim();
      if (key === 'LRN') lrn = val;
      else if (key === 'ID') idNumber = val;
    });
  } else if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const obj = JSON.parse(text);
      lrn = obj.lrn || obj.student_lrn || '';
      idNumber = obj.id || obj.id_number || '';
    } catch {}
  } else {
    if (/^\d{12}$/.test(text)) lrn = text;
    else if (text.includes('ST-') || /^\d{4}-\w+-\d+$/.test(text)) idNumber = text;
    else lrn = text;
  }

  return { lrn: lrn || null, idNumber: idNumber || null, rawText: text };
};

// ============================================
// COMPONENT
// ============================================
export default function TeacherStudentQRAttendance() {
  const { primaryColor, theme } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // State
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Teacher');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Scanner config
  const [sessionMode, setSessionMode] = useState<'time_in' | 'time_out'>('time_in');
  const [markingPolicy, setMarkingPolicy] = useState<'present' | 'late' | 'auto'>('auto');

  // Manual input
  const [manualInput, setManualInput] = useState('');

  // Results
  const [lastScan, setLastScan] = useState<ScannedRecord | null>(null);
  const [recentScans, setRecentScans] = useState<ScannedRecord[]>([]);
  const [showResultCard, setShowResultCard] = useState(false);
  const [duplicates, setDuplicates] = useState(0);

  const scanLockRef = useRef<number>(0);

  // ============================================
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;
      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('email', email)
        .maybeSingle();
      if (!userData) return;
      const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Teacher';
      setDisplayName(name);

      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userData.id)
        .maybeSingle();
      if (teacherData) setTeacherId(teacherData.id);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CAMERA HANDLERS
  // ============================================
  const toggleScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Camera Permission', 'Please allow camera access to scan QR codes.');
        return;
      }
    }
    setScanning((prev) => !prev);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    const now = Date.now();
    if (now - scanLockRef.current < 2500) return; // throttle scans
    scanLockRef.current = now;

    const parsed = parseStudentPayload(data);
    if (parsed) processScan(parsed);
  };

  // ============================================
  // SCAN PROCESSOR
  // ============================================
  const processScan = async (parsed: { lrn: string | null; idNumber: string | null; rawText: string }) => {
    let student: Student | null = null;

    // 1. Lookup in Supabase
    try {
      let query = supabase.from('students').select('*');
      if (parsed.idNumber) {
        query = query.or(`id_number.eq.${parsed.idNumber},lrn.eq.${parsed.idNumber}`);
      } else if (parsed.lrn) {
        query = query.eq('lrn', parsed.lrn);
      } else if (parsed.rawText) {
        query = query.or(`lrn.eq.${parsed.rawText},id_number.eq.${parsed.rawText}`);
      }
      const { data: dbStudent } = await query.limit(1).maybeSingle();
      if (dbStudent) {
        student = {
          id: dbStudent.id,
          full_name:
            dbStudent.full_name ||
            `${dbStudent.first_name || ''} ${dbStudent.last_name || ''}`.trim() ||
            'Student',
          lrn: dbStudent.lrn || dbStudent.student_id || '—',
          id_number: dbStudent.id_number || dbStudent.lrn || '—',
          grade_level: dbStudent.grade_level || '—',
          section: dbStudent.section || '—',
          strand: dbStudent.strand || '—',
          parent_name: dbStudent.parent_name || dbStudent.guardian_name || 'PARENT / GUARDIAN',
          parent_contact: dbStudent.parent_contact || dbStudent.guardian_contact || '—',
          photo_url: dbStudent.photo_url || dbStudent.avatar_url || dbStudent.two_by_two_picture_url || '',
          email: (dbStudent.email || '').toLowerCase().trim(),
        };
      }
    } catch (err) {
      console.warn('Student lookup failed:', err);
    }

    if (!student) {
      Alert.alert('Not Found', `No student found matching "${parsed.rawText}".`);
      return;
    }

    const now = new Date();
    const todayStr = getTodayDateString();
    const timeStr = getCurrentTimeString();

    // 2. Duplicate detection (local state)
    const isDuplicate = recentScans.some(
      (s) => s.studentId === student!.id && s.mode === sessionMode && s.date === todayStr
    );

    if (isDuplicate) {
      setDuplicates((d) => d + 1);
      const dupRecord: ScannedRecord = {
        id: 'scan_' + Date.now(),
        studentId: student.id,
        name: student.full_name,
        lrn: student.lrn,
        idNo: student.id_number,
        grade: student.grade_level,
        section: student.section,
        strand: student.strand,
        time: timeStr,
        date: todayStr,
        status: 'Duplicate',
        mode: sessionMode,
      };
      setLastScan(dupRecord);
      setShowResultCard(true);
      return;
    }

    // 3. Determine Status
    let status: 'Present' | 'Late' = 'Present';
    if (sessionMode === 'time_in') {
      if (markingPolicy === 'late') status = 'Late';
      else if (markingPolicy === 'auto') {
        if (now.getHours() > LATE_CUTOFF_HOUR || (now.getHours() === LATE_CUTOFF_HOUR && now.getMinutes() > LATE_CUTOFF_MINUTE)) {
          status = 'Late';
        }
      }
    }

    const record: ScannedRecord = {
      id: 'scan_' + Date.now(),
      studentId: student.id,
      name: student.full_name,
      lrn: student.lrn,
      idNo: student.id_number,
      grade: student.grade_level,
      section: student.section,
      strand: student.strand,
      time: timeStr,
      date: todayStr,
      status,
      mode: sessionMode,
    };

    // 4. Update local state
    setLastScan(record);
    setShowResultCard(true);
    setRecentScans((prev) => [record, ...prev].slice(0, 50));

    // 5. Sync to Supabase
    syncAttendanceToSupabase(record, student);
  };

  // ============================================
  // SUPABASE SYNC
  // ============================================
  const syncAttendanceToSupabase = async (record: ScannedRecord, student: Student) => {
    try {
      const cleanStatus = (record.status || 'present').toLowerCase();
      const attendanceRow: any = {
        student_id: record.studentId,
        date: record.date,
        status: cleanStatus,
        remarks: record.status === 'Late' ? 'Late arrival via QR Scanner' : 'On-time QR scan',
      };
      if (record.mode === 'time_in') attendanceRow.time_in = record.time;
      else attendanceRow.time_out = record.time;

      // Check if record exists for today (to update time_out without breaking time_in)
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', record.studentId)
        .eq('date', record.date)
        .maybeSingle();

      if (existing && record.mode === 'time_out') {
        await supabase.from('attendance').update({ time_out: record.time }).eq('id', existing.id);
      } else {
        await supabase.from('attendance').upsert([attendanceRow], { onConflict: 'student_id,date' });
      }

      // Notify student
      try {
        let targetUserId = student.id;
        const { data: uData } = await supabase
          .from('users')
          .select('id')
          .eq('student_id', student.id)
          .maybeSingle();
        if (uData?.id) targetUserId = uData.id;

        await supabase.from('notifications').insert([
          {
            user_id: targetUserId,
            role: 'student',
            title: `Attendance: ${record.status}`,
            message: `Your attendance was marked as ${record.status} on ${record.date} at ${record.time} by Teacher ${displayName}.`,
            type: 'attendance',
            is_read: false,
            read: false,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (notifErr) {
        console.warn('Notification sync skipped:', notifErr);
      }
    } catch (err) {
      console.warn('Attendance sync failed:', err);
    }
  };

  // ============================================
  // MANUAL INPUT SUBMIT
  // ============================================
  const submitManual = () => {
    const raw = manualInput.trim();
    if (!raw) return;
    setManualInput('');
    const parsed = parseStudentPayload(raw);
    processScan(parsed);
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // PERMISSION GATE
  // ============================================
  if (!permission?.granted) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={60} color={NEU.textMuted} />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>Please allow camera access to scan student QR codes.</Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: primaryColor }]}
            onPress={requestPermission}
          >
            <Ionicons name="camera" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // MAIN UI
  // ============================================
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)}>
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Student QR Attendance</Text>
            <Text style={styles.subGreeting}>Scan student ID cards</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={bootstrap}>
            <Ionicons name="refresh-outline" size={20} color={NEU.text} />
          </TouchableOpacity>
        </View>

        {/* Session Config */}
        <View style={styles.configCard}>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Session Mode</Text>
            <View style={styles.configOptions}>
              <TouchableOpacity
                style={[styles.configChip, sessionMode === 'time_in' && styles.configChipActive]}
                onPress={() => setSessionMode('time_in')}
              >
                <Text style={[styles.configChipText, sessionMode === 'time_in' && styles.configChipTextActive]}>
                  Time In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.configChip, sessionMode === 'time_out' && styles.configChipActive]}
                onPress={() => setSessionMode('time_out')}
              >
                <Text style={[styles.configChipText, sessionMode === 'time_out' && styles.configChipTextActive]}>
                  Time Out
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.configRow}>
            <Text style={styles.configLabel}>Marking Policy</Text>
            <View style={styles.configOptions}>
              {(['present', 'late', 'auto'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.configChip, markingPolicy === p && styles.configChipActive]}
                  onPress={() => setMarkingPolicy(p)}
                >
                  <Text style={[styles.configChipText, markingPolicy === p && styles.configChipTextActive]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Camera Preview */}
        <View style={styles.cameraBox}>
          {scanning ? (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarCodeScanned}
            />
          ) : (
            <View style={styles.cameraStandby}>
              <Ionicons name="scan-outline" size={60} color={NEU.textMuted} />
              <Text style={styles.cameraStandbyText}>Camera is off</Text>
              <Text style={styles.cameraStandbySub}>Tap below to start scanning</Text>
            </View>
          )}

          {/* Laser Line (visual) */}
          {scanning && <View style={[styles.laserLine, { backgroundColor: primaryColor }]} />}
        </View>

        {/* Camera Controls */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: scanning ? NEU.danger : primaryColor }]}
          onPress={toggleScanner}
        >
          <Ionicons name={scanning ? 'stop' : 'scan'} size={20} color="#fff" />
          <Text style={styles.primaryBtnText}>{scanning ? 'Stop Scanner' : 'Start Scanner'}</Text>
        </TouchableOpacity>

        {/* Manual Input */}
        <View style={styles.manualCard}>
          <Text style={styles.manualTitle}>Manual / Hardware Scanner</Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="Enter LRN or Student ID"
              placeholderTextColor={NEU.textMuted}
              value={manualInput}
              onChangeText={setManualInput}
              onSubmitEditing={submitManual}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.manualSubmit, { backgroundColor: primaryColor }]}
              onPress={submitManual}
            >
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* KPI Row */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{recentScans.length}</Text>
            <Text style={styles.kpiLabel}>Total Scanned</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: NEU.success }]}>
              {recentScans.filter((s) => s.status === 'Present').length}
            </Text>
            <Text style={styles.kpiLabel}>Present</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: NEU.warning }]}>
              {recentScans.filter((s) => s.status === 'Late').length}
            </Text>
            <Text style={styles.kpiLabel}>Late</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: NEU.danger }]}>{duplicates}</Text>
            <Text style={styles.kpiLabel}>Duplicates</Text>
          </View>
        </View>

        {/* Recent Scans */}
        <Text style={styles.sectionLabel}>RECENT SCANS</Text>
        {recentScans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="qr-code-outline" size={44} color={NEU.textMuted} />
            <Text style={styles.emptyText}>No scans yet today</Text>
            <Text style={styles.emptySub}>Start the camera to log attendance</Text>
          </View>
        ) : (
          recentScans.map((s) => (
            <View key={s.id} style={styles.scanRow}>
              <View style={styles.scanAvatar}>
                <Text style={styles.scanAvatarText}>{(s.name || 'S').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.scanName}>{s.name}</Text>
                <Text style={styles.scanMeta}>
                  LRN: {s.lrn} · {s.grade} - {s.section}
                </Text>
                <Text style={styles.scanTime}>
                  {s.time} · {s.mode === 'time_in' ? 'Time In' : 'Time Out'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      s.status === 'Present'
                        ? NEU.success + '20'
                        : s.status === 'Late'
                        ? NEU.warning + '20'
                        : NEU.danger + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color:
                        s.status === 'Present'
                          ? NEU.success
                          : s.status === 'Late'
                          ? NEU.warning
                          : NEU.danger,
                    },
                  ]}
                >
                  {s.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Result Card Modal */}
      <Modal
        visible={showResultCard}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResultCard(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.resultCard}>
            {lastScan && (
              <>
                <View
                  style={[
                    styles.resultBadge,
                    {
                      backgroundColor:
                        lastScan.status === 'Present'
                          ? NEU.success + '20'
                          : lastScan.status === 'Late'
                          ? NEU.warning + '20'
                          : NEU.danger + '20',
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      lastScan.status === 'Present'
                        ? 'checkmark-circle'
                        : lastScan.status === 'Late'
                        ? 'time'
                        : 'alert-circle'
                    }
                    size={20}
                    color={
                      lastScan.status === 'Present'
                        ? NEU.success
                        : lastScan.status === 'Late'
                        ? NEU.warning
                        : NEU.danger
                    }
                  />
                  <Text
                    style={[
                      styles.resultBadgeText,
                      {
                        color:
                          lastScan.status === 'Present'
                            ? NEU.success
                            : lastScan.status === 'Late'
                            ? NEU.warning
                            : NEU.danger,
                      },
                    ]}
                  >
                    {lastScan.status.toUpperCase()} RECORDED
                  </Text>
                </View>

                <View style={styles.resultAvatar}>
                  <Text style={styles.resultAvatarText}>{lastScan.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.resultName}>{lastScan.name}</Text>
                <Text style={styles.resultMeta}>
                  {lastScan.grade} · {lastScan.section}
                </Text>
                <Text style={styles.resultLrn}>LRN: {lastScan.lrn}</Text>
                <Text style={styles.resultTime}>{lastScan.time}</Text>

                <TouchableOpacity
                  style={[styles.resultCloseBtn, { backgroundColor: primaryColor }]}
                  onPress={() => setShowResultCard(false)}
                >
                  <Text style={styles.resultCloseText}>Continue Scanning</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <TeacherSidebar visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NEU.bg },
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 },
  headerCenter: { flex: 1, alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: NEU.bg, borderWidth: 1, borderColor: NEU.bgDark },
  greeting: { fontSize: 16, fontWeight: '700', color: NEU.text },
  subGreeting: { fontSize: 12, color: NEU.textMuted, marginTop: 2 },

  permissionTitle: { fontSize: 18, fontWeight: '800', color: NEU.text, marginTop: 16 },
  permissionText: { fontSize: 13, color: NEU.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 20 },

  configCard: {
    padding: 16, borderRadius: 20, backgroundColor: NEU.bg, marginBottom: 16,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1, borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  configRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  configLabel: { fontSize: 13, fontWeight: '600', color: NEU.text },
  configOptions: { flexDirection: 'row', gap: 6 },
  configChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: NEU.bgDark, backgroundColor: NEU.bg },
  configChipActive: { backgroundColor: NEU.accent, borderColor: NEU.accent },
  configChipText: { fontSize: 12, fontWeight: '600', color: NEU.textMuted },
  configChipTextActive: { color: '#fff' },
  divider: { height: 1, backgroundColor: NEU.bgDark, marginVertical: 8, opacity: 0.5 },

  cameraBox: {
    height: 340, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111',
    marginBottom: 12,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
  },
  camera: { flex: 1 },
  cameraStandby: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  cameraStandbyText: { fontSize: 15, fontWeight: '700', color: '#94a3b8', marginTop: 8 },
  cameraStandbySub: { fontSize: 12, color: '#64748b' },
  laserLine: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, opacity: 0.8 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, gap: 8, marginBottom: 16,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  manualCard: {
    padding: 14, borderRadius: 16, backgroundColor: NEU.bg, marginBottom: 16,
    borderWidth: 1, borderColor: NEU.bgDark,
  },
  manualTitle: { fontSize: 11, fontWeight: '700', color: NEU.textMuted, letterSpacing: 0.8, marginBottom: 8, textTransform: 'uppercase' },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: NEU.bgDark, fontSize: 13, color: NEU.text, backgroundColor: '#fff',
  },
  manualSubmit: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpiCard: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderRadius: 16, backgroundColor: NEU.bg,
    borderWidth: 1, borderColor: NEU.bgDark,
  },
  kpiValue: { fontSize: 20, fontWeight: '800', color: NEU.text },
  kpiLabel: { fontSize: 10, color: NEU.textMuted, marginTop: 2, fontWeight: '600' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: NEU.textMuted, letterSpacing: 1, marginBottom: 10 },

  emptyCard: {
    padding: 30, alignItems: 'center', borderRadius: 16,
    backgroundColor: NEU.bg, borderWidth: 1, borderColor: NEU.bgDark, marginBottom: 20,
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: NEU.text, marginTop: 10 },
  emptySub: { fontSize: 12, color: NEU.textMuted, marginTop: 4 },

  scanRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, marginBottom: 8, borderRadius: 16,
    backgroundColor: NEU.bg, borderWidth: 1, borderColor: NEU.bgDark,
  },
  scanAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: NEU.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  scanAvatarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  scanName: { fontSize: 13, fontWeight: '700', color: NEU.text },
  scanMeta: { fontSize: 11, color: NEU.textMuted, marginTop: 2 },
  scanTime: { fontSize: 11, color: NEU.textMuted, marginTop: 2, fontStyle: 'italic' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  resultCard: {
    width: '100%', maxWidth: 380, padding: 24, borderRadius: 24,
    backgroundColor: '#fff', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  resultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 16,
  },
  resultBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  resultAvatar: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: NEU.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  resultAvatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  resultName: { fontSize: 18, fontWeight: '800', color: NEU.text, textAlign: 'center' },
  resultMeta: { fontSize: 13, color: NEU.textMuted, marginTop: 2 },
  resultLrn: { fontSize: 12, color: NEU.textMuted, marginTop: 8 },
  resultTime: { fontSize: 24, fontWeight: '800', color: NEU.accent, marginTop: 12 },
  resultCloseBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  resultCloseText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});