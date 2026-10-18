import TeacherSidebar from '@/components/TeacherSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

type Section = { id: string; name: string; grade_level: string };
type Subject = { id: string; name: string; code: string; subject_type: string };
type Student = { id: string; lrn: string; full_name: string; grade: string; existingGradeId?: string };

const NEU = {
  bg: '#E8EDF2',
  bgDark: '#D1D9E6',
  lightShadow: '#FFFFFF',
  darkShadow: '#A3B1C6',
  text: '#2E3A4D',
  textMuted: '#7A8699',
  textFaint: '#A0ACBE',
  accent: '#4C6FFF',
  danger: '#EF4444',
};

export default function TeacherGrades() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subject?: string; section?: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjectModal, setSubjectModal] = useState(false);
  const [sectionModal, setSectionModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { loadTeacherData(); }, []);

  const loadTeacherData = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) { setLoading(false); return; }
      const { data: userData } = await supabase.from('users').select('*').eq('email', email).single();
      const { data: teacherData } = await supabase.from('teachers').select('id').eq('user_id', userData?.id).maybeSingle();
      if (!teacherData) { setLoading(false); return; }
      const { data: scheds } = await supabase.from('schedules').select('subject_id, section_id').eq('teacher_id', teacherData.id);
      const subjectIds = [...new Set((scheds || []).map((s: any) => s.subject_id).filter(Boolean))];
      const sectionIds = [...new Set((scheds || []).map((s: any) => s.section_id).filter(Boolean))];
      const { data: subs } = await supabase.from('subjects').select('id, name, code, subject_type').in('id', subjectIds);
      const { data: secs } = await supabase.from('sections').select('id, name, grade_level').in('id', sectionIds);
      setSubjects(subs || []);
      setSections(secs || []);
      if (params.subject && params.section) {
        const s = (subs || []).find((x: any) => x.id === params.subject);
        const sec = (secs || []).find((x: any) => x.id === params.section);
        if (s && sec) {
          setSelectedSubject(s);
          setSelectedSection(sec);
          await loadStudents(sec.id, s.id, 1);
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadStudents = async (sectionId: string, subjectId: string, quarter: number) => {
    setLoading(true);
    try {
      const { data: studs } = await supabase
        .from('students').select('id, lrn, first_name, last_name')
        .eq('section_id', sectionId).order('last_name');
      if (!studs) { setLoading(false); return; }
      const { data: existingGrades } = await supabase
        .from('grades').select('id, student_id, grade')
        .in('student_id', studs.map(s => s.id))
        .eq('subject_id', subjectId).eq('quarter', quarter);
      const gradeMap: Record<string, any> = {};
      (existingGrades || []).forEach((g: any) => { gradeMap[g.student_id] = g; });
      setStudents(
        studs.map((s: any) => ({
          id: s.id,
          lrn: s.lrn || 'N/A',
          full_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unknown',
          grade: gradeMap[s.id]?.grade?.toString() || '',
          existingGradeId: gradeMap[s.id]?.id,
        }))
      );
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const updateGrade = (studentId: string, grade: string) => {
    setStudents(prev => prev.map(s => (s.id === studentId ? { ...s, grade } : s)));
  };

  const handleSave = async () => {
    if (!selectedSection || !selectedSubject) return;
    const valid = students.filter(s => s.grade.trim() !== '');
    if (valid.length === 0) { Alert.alert('Error', 'No grades to save'); return; }
    setSaving(true);
    try {
      const rows = valid.map(s => ({
        student_id: s.id,
        subject_id: selectedSubject.id,
        section_id: selectedSection.id,
        quarter: selectedQuarter,
        grade: parseFloat(s.grade),
      }));
      await supabase.from('grades').delete()
        .eq('subject_id', selectedSubject.id)
        .eq('section_id', selectedSection.id)
        .eq('quarter', selectedQuarter)
        .in('student_id', students.map(s => s.id));
      const { error } = await supabase.from('grades').insert(rows);
      if (error) throw error;
      Alert.alert('Success', 'Grades saved!');
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const getGradeColor = (g: string) => {
    const n = parseFloat(g);
    if (isNaN(n)) return NEU.textMuted;
    if (n >= 90) return '#4CAF50';
    if (n >= 85) return '#8BC34A';
    if (n >= 80) return '#FFC107';
    if (n >= 75) return '#FF9800';
    return '#F44336';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingOrb}>
            <ActivityIndicator size="small" color={NEU.accent} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Grades</Text>
            <Text style={styles.subGreeting}>Record student grades</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.selectorRow}>
          <TouchableOpacity style={styles.selectorCard} onPress={() => setSectionModal(true)} activeOpacity={0.7}>
            <Text style={styles.selectorLabel}>Section</Text>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {selectedSection?.name || 'Select'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectorCard} onPress={() => setSubjectModal(true)} activeOpacity={0.7}>
            <Text style={styles.selectorLabel}>Subject</Text>
            <Text style={styles.selectorValue} numberOfLines={1}>
              {selectedSubject?.name || 'Select'}
            </Text>
          </TouchableOpacity>
        </View>

        {selectedSection && selectedSubject && (
          <View style={styles.quarterRow}>
            {[1, 2, 3, 4].map(q => (
              <TouchableOpacity
                key={q}
                style={[styles.quarterBtn, selectedQuarter === q && styles.quarterBtnActive]}
                onPress={() => {
                  setSelectedQuarter(q);
                  loadStudents(selectedSection.id, selectedSubject.id, q);
                }}
              >
                <Text style={[styles.quarterText, selectedQuarter === q && styles.quarterTextActive]}>Q{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {selectedSection && selectedSubject ? (
          <>
            {students.map(s => (
              <View key={s.id} style={styles.studentCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName} numberOfLines={1}>{s.full_name}</Text>
                  <Text style={styles.studentLrn}>LRN: {s.lrn}</Text>
                </View>
                <TextInput
                  style={[
                    styles.gradeInput,
                    {
                      borderColor: s.grade ? getGradeColor(s.grade) : NEU.bgDark,
                      color: s.grade ? getGradeColor(s.grade) : NEU.text,
                    },
                  ]}
                  value={s.grade}
                  onChangeText={t => updateGrade(s.id, t)}
                  keyboardType="numeric"
                  placeholder="--"
                  placeholderTextColor={NEU.textMuted}
                  maxLength={5}
                />
              </View>
            ))}

            {students.length === 0 && (
              <View style={styles.infoCard}>
                <View style={styles.emptyBox}>
                  <Ionicons name="people-outline" size={48} color={NEU.textMuted} />
                  <Text style={styles.emptyTitle}>No students in this section</Text>
                </View>
              </View>
            )}

            {students.length > 0 && (
              <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                <Ionicons name="save" size={18} color="#FFFFFF" />
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Grades'}</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.infoCard}>
            <View style={styles.emptyBox}>
              <Ionicons name="star-outline" size={48} color={NEU.textMuted} />
              <Text style={styles.emptyTitle}>Select section and subject to enter grades</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={sectionModal} onRequestClose={() => setSectionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Section</Text>
              <TouchableOpacity onPress={() => setSectionModal(false)}>
                <Ionicons name="close" size={24} color={NEU.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {sections.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedSection(s);
                    setSectionModal(false);
                    if (selectedSubject) loadStudents(s.id, selectedSubject.id, selectedQuarter);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{s.name}</Text>
                    <Text style={styles.modalItemSub}>Grade {s.grade_level}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={NEU.textFaint} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent visible={subjectModal} onRequestClose={() => setSubjectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Subject</Text>
              <TouchableOpacity onPress={() => setSubjectModal(false)}>
                <Ionicons name="close" size={24} color={NEU.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {subjects.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedSubject(s);
                    setSubjectModal(false);
                    if (selectedSection) loadStudents(selectedSection.id, s.id, selectedQuarter);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemTitle}>{s.name}</Text>
                    <Text style={styles.modalItemSub}>{s.code} • {s.subject_type}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={NEU.textFaint} />
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

  selectorRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  selectorCard: {
    flex: 1, paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 10, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  selectorLabel: { fontSize: 11, color: NEU.textFaint, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  selectorValue: { fontSize: 13, fontWeight: '600', color: NEU.text, marginTop: 4 },

  quarterRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quarterBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14,
    alignItems: 'center', backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.5, shadowRadius: 6, elevation: 3,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  quarterBtnActive: { backgroundColor: NEU.accent, borderTopColor: NEU.accent, borderLeftColor: NEU.accent },
  quarterText: { fontSize: 13, fontWeight: '600', color: NEU.text },
  quarterTextActive: { color: '#FFFFFF', fontWeight: '800' },

  studentCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16, marginBottom: 8,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  studentName: { fontSize: 13, fontWeight: '600', color: NEU.text },
  studentLrn: { fontSize: 11, color: NEU.textMuted, marginTop: 2 },
  gradeInput: {
    borderWidth: 1.5, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10,
    minWidth: 70, textAlign: 'center', fontSize: 14, fontWeight: '700',
    backgroundColor: NEU.bg,
  },

  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, gap: 8, marginTop: 12,
    backgroundColor: NEU.accent,
    shadowColor: NEU.accent, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  saveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },

  infoCard: {
    paddingVertical: 8, paddingHorizontal: 20, marginBottom: 20,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  emptyBox: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 13, color: NEU.textMuted, marginTop: 12, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(46,58,77,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: NEU.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: NEU.bgDark,
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