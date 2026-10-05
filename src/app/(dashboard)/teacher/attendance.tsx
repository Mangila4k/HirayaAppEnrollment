import { useTheme } from '@/app/_context/themecontext';
import TeacherSidebar from '@/components/TeacherSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Section = { id: string; name: string; grade_level: string };
type Subject = { id: string; name: string; code: string };
type StatusValue = 'present' | 'absent' | 'late';
type Student = {
  id: string;
  lrn: string;
  full_name: string;
  gender: string;
  status: StatusValue | null;
  attendance_id?: string;
};

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

export default function TeacherAttendance() {
  const { primaryColor, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [sectionModalVisible, setSectionModalVisible] = useState(false);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) { setLoading(false); return; }
      const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
      if (!userData) { setLoading(false); return; }
      const { data: teacherData } = await supabase.from('teachers').select('id').eq('user_id', userData.id).maybeSingle();
      if (!teacherData) { setLoading(false); return; }
      const { data: scheds } = await supabase.from('schedules').select('section_id, subject_id').eq('teacher_id', teacherData.id);
      if (!scheds) { setLoading(false); return; }
      const sectionIds = [...new Set(scheds.map((s: any) => s.section_id).filter(Boolean))];
      const subjectIds = [...new Set(scheds.map((s: any) => s.subject_id).filter(Boolean))];
      if (sectionIds.length > 0) {
        const { data: secs } = await supabase.from('sections').select('id, name, grade_level').in('id', sectionIds);
        setSections(secs || []);
      }
      if (subjectIds.length > 0) {
        const { data: subs } = await supabase.from('subjects').select('id, name, code').in('id', subjectIds);
        setSubjects(subs || []);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadStudents = async (section: Section, subject: Subject) => {
    setSelectedSection(section);
    setSelectedSubject(subject);
    setSectionModalVisible(false);
    setSubjectModalVisible(false);
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: studs } = await supabase
        .from('students').select('id, lrn, first_name, last_name, gender')
        .eq('section_id', section.id).order('last_name');
      if (!studs) { setLoading(false); return; }
      const { data: att } = await supabase
        .from('attendance').select('id, student_id, status')
        .in('student_id', studs.map(s => s.id))
        .eq('date', today).eq('subject_id', subject.id);
      const attMap: Record<string, any> = {};
      (att || []).forEach((a: any) => { attMap[a.student_id] = a; });
      setStudents(
        studs.map((s: any) => ({
          id: s.id,
          lrn: s.lrn || 'N/A',
          full_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
          gender: s.gender || 'N/A',
          status: (attMap[s.id]?.status as StatusValue) || null,
          attendance_id: attMap[s.id]?.id,
        }))
      );
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const isStudentLocked = (s: Student) => !!s.attendance_id;

  const markStudent = (studentId: string, status: StatusValue) => {
    const target = students.find(s => s.id === studentId);
    if (target && isStudentLocked(target)) {
      Alert.alert('Already Submitted', `${target.full_name}'s attendance is locked.`);
      return;
    }
    setStudents(prev => prev.map(s => (s.id === studentId ? { ...s, status } : s)));
  };

  const markAll = (status: StatusValue) => {
    setStudents(prev => prev.map(s => (isStudentLocked(s) ? s : { ...s, status })));
  };

  const handleSave = async () => {
    if (!selectedSection || !selectedSubject) {
      Alert.alert('Error', 'Please select section and subject first');
      return;
    }
    const editable = students.filter(s => !isStudentLocked(s));
    if (editable.length === 0) { Alert.alert('Nothing to Save', 'All students already saved.'); return; }
    const unmarked = editable.filter(s => !s.status);
    if (unmarked.length > 0) { Alert.alert('Incomplete', `${unmarked.length} unmarked.`); return; }
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = editable.map(s => ({
        student_id: s.id, subject_id: selectedSubject.id, date: today,
        status: (s.status || '').toLowerCase(),
      }));
      await supabase.from('attendance').delete()
        .eq('subject_id', selectedSubject.id).eq('date', today)
        .in('student_id', editable.map(s => s.id));
      const { error } = await supabase.from('attendance').insert(rows);
      if (error) throw error;
      Alert.alert('Success', 'Attendance saved!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  const getStatusColor = (s: string | null) => {
    if (s === 'present') return '#4CAF50';
    if (s === 'absent') return '#F44336';
    if (s === 'late') return '#FF9800';
    return NEU.textMuted;
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
            <Text style={styles.greeting}>Attendance</Text>
            <Text style={styles.subGreeting}>Mark student attendance</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.infoCard}>
          <TouchableOpacity style={styles.selectorRow} onPress={() => setSectionModalVisible(true)} activeOpacity={0.7}>
            <Text style={styles.infoLabel}>Section</Text>
            <View style={styles.selectorValueRow}>
              <Text style={styles.infoValue} numberOfLines={1}>
                {selectedSection ? `${selectedSection.name} • Grade ${selectedSection.grade_level}` : 'Select Section'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={NEU.textFaint} />
            </View>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={[styles.selectorRow, !selectedSection && { opacity: 0.5 }]}
            onPress={() => {
              if (!selectedSection) { Alert.alert('Select Section', 'Please pick a section first'); return; }
              setSubjectModalVisible(true);
            }}
            disabled={!selectedSection}
            activeOpacity={0.7}
          >
            <Text style={styles.infoLabel}>Subject</Text>
            <View style={styles.selectorValueRow}>
              <Text style={styles.infoValue} numberOfLines={1}>
                {selectedSubject ? `${selectedSubject.name} (${selectedSubject.code})` : 'Select Subject'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={NEU.textFaint} />
            </View>
          </TouchableOpacity>
        </View>

        {selectedSection && selectedSubject && students.length > 0 && (
          <View style={styles.bulkRow}>
            <TouchableOpacity style={[styles.bulkBtn, { borderColor: '#4CAF50' }]} onPress={() => markAll('present')}>
              <Text style={[styles.bulkText, { color: '#4CAF50' }]}>All Present</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { borderColor: '#FF9800' }]} onPress={() => markAll('late')}>
              <Text style={[styles.bulkText, { color: '#FF9800' }]}>All Late</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkBtn, { borderColor: '#F44336' }]} onPress={() => markAll('absent')}>
              <Text style={[styles.bulkText, { color: '#F44336' }]}>All Absent</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedSection && selectedSubject && students.length > 0 ? (
          <>
            {students.map(st => {
              const locked = isStudentLocked(st);
              return (
                <View key={st.id} style={[styles.studentCard, locked && { opacity: 0.75 }]}>
                  <View style={styles.studentInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.studentName}>{st.full_name}</Text>
                      {locked && <Ionicons name="lock-closed" size={12} color={NEU.textMuted} />}
                    </View>
                    <Text style={styles.studentLrn}>LRN: {st.lrn}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    {(['present', 'late', 'absent'] as const).map(status => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusBtn,
                          st.status === status && {
                            backgroundColor: getStatusColor(status) + '20',
                            borderColor: getStatusColor(status),
                          },
                        ]}
                        onPress={() => markStudent(st.id, status)}
                        disabled={locked}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: st.status === status ? getStatusColor(status) : NEU.textMuted },
                            st.status === status && { fontWeight: '700' },
                          ]}
                        >
                          {status.charAt(0).toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: primaryColor }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="save" size={18} color="#FFFFFF" />
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Attendance'}</Text>
            </TouchableOpacity>
          </>
        ) : selectedSection && selectedSubject ? (
          <View style={styles.infoCard}>
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={48} color={NEU.textMuted} />
              <Text style={styles.emptyTitle}>No students in this section</Text>
            </View>
          </View>
        ) : selectedSection && !selectedSubject ? (
          <View style={styles.infoCard}>
            <View style={styles.emptyBox}>
              <Ionicons name="book-outline" size={48} color={NEU.textMuted} />
              <Text style={styles.emptyTitle}>Please select a subject to continue</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Section Modal */}
      <Modal animationType="slide" transparent visible={sectionModalVisible} onRequestClose={() => setSectionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Section</Text>
              <TouchableOpacity onPress={() => setSectionModalVisible(false)}>
                <Ionicons name="close" size={24} color={NEU.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {sections.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.modalItem}
                  onPress={() => { setSelectedSection(s); setSelectedSubject(null); setStudents([]); setSectionModalVisible(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{s.name}</Text>
                    <Text style={styles.modalItemSub}>Grade {s.grade_level}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={NEU.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Subject Modal */}
      <Modal animationType="slide" transparent visible={subjectModalVisible} onRequestClose={() => setSubjectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Subject</Text>
              <TouchableOpacity onPress={() => setSubjectModalVisible(false)}>
                <Ionicons name="close" size={24} color={NEU.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {subjects.map(sub => (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.modalItem}
                  onPress={() => { if (selectedSection) loadStudents(selectedSection, sub); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{sub.name}</Text>
                    <Text style={styles.modalItemSub}>{sub.code}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={NEU.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  infoCard: {
    paddingVertical: 8, paddingHorizontal: 20, marginBottom: 20,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  selectorRow: { paddingVertical: 14 },
  selectorValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  infoLabel: { fontSize: 11, color: NEU.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: '700' },
  infoValue: { fontSize: 14, fontWeight: '600', color: NEU.text, flex: 1, marginRight: 8 },
  divider: { height: 1, backgroundColor: NEU.bgDark, opacity: 0.5 },
  bulkRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  bulkBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', backgroundColor: NEU.bg },
  bulkText: { fontSize: 12, fontWeight: '700' },
  studentCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18,
    marginBottom: 10, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 10, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: NEU.text },
  studentLrn: { fontSize: 11, color: NEU.textMuted, marginTop: 2 },
  statusRow: { flexDirection: 'row', gap: 6 },
  statusBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, borderColor: NEU.bgDark,
    alignItems: 'center', justifyContent: 'center', backgroundColor: NEU.bg,
  },
  statusText: { fontSize: 13, color: NEU.textMuted },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, gap: 8, marginTop: 12,
  },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 13, color: NEU.textMuted, marginTop: 12, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(46,58,77,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: NEU.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: NEU.bgDark,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: NEU.text },
  modalItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: NEU.bgDark,
  },
  modalItemTitle: { fontSize: 14, fontWeight: '600', color: NEU.text },
  modalItemSub: { fontSize: 12, color: NEU.textMuted, marginTop: 2 },
});