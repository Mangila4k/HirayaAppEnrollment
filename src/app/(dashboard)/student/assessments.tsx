import StudentSidebar from '@/components/StudentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
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

type Assessment = {
  id: string;
  title: string;
  description: string;
  subject_name: string;
  type: string;
  teacher_name: string;
  teacher_id: string;
  due_date: string | null;
  total_points: number;
  attachment_url?: string;
  attachment_name?: string;
  section_id?: string;
  section_name?: string;
};

type Submission = {
  id: string;
  assessment_id: string;
  status: 'submitted' | 'late' | 'graded';
  score?: number;
  feedback?: string;
  submission_text?: string;
  file_url?: string;
  file_name?: string;
  link_url?: string;
  submitted_at: string;
  graded_at?: string;
};

export default function StudentAssessments() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const [studentRow, setStudentRow] = useState<any>(null);
  const [studentName, setStudentName] = useState('Student');
  
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  
  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<'all' | 'todo' | 'passed' | 'graded' | 'missing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Submission Form State
  const [isEditing, setIsEditing] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error('No user email found');

      // 1. Fetch Student Data
      let student: any = null;
      const { data: userData } = await supabase.from('users').select('student_id').eq('email', email).maybeSingle();
      if (userData?.student_id) {
        const { data } = await supabase.from('students').select('*').eq('id', userData.student_id).maybeSingle();
        student = data;
      }
      if (!student) {
        const { data } = await supabase.from('students').select('*').eq('email', email).maybeSingle();
        student = data;
      }
      if (!student) throw new Error('Student record not found');
      
      setStudentRow(student);
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      setStudentName(fullName || 'Student');

      // 2. Fetch Section Info
      let studentSecId = student.section_id || '';
      let studentSecName = (student.section || student.section_name || '').toLowerCase().trim();
      let studentGrade = (student.grade_level || '').toLowerCase().trim();

      if (studentSecId && !studentSecName) {
        const { data: sec } = await supabase.from('sections').select('name').eq('id', studentSecId).maybeSingle();
        if (sec) studentSecName = (sec.name || '').toLowerCase().trim();
      }

      // 3. Fetch Assessments
      const { data: allAssessments, error: assErr } = await supabase
        .from('assessments')
        .select('*')
        .eq('status', 'published')
        .order('due_date', { ascending: true });

      if (assErr) throw assErr;

      // Filter exactly like the web app
      const filteredAssessments = (allAssessments || []).filter(a => {
        if (a.section_id) {
          if (studentSecId && String(a.section_id) === String(studentSecId)) return true;
          if (studentSecName && a.section_name && a.section_name.toLowerCase().includes(studentSecName)) return true;
          return false;
        }
        if (a.section_name && studentGrade) {
          if (a.section_name.toLowerCase().includes(studentGrade)) return true;
        }
        if (!a.section_id && (!a.section_name || a.section_name.toLowerCase() === 'general' || a.section_name.toLowerCase() === 'all students')) {
          return true;
        }
        return false;
      });

      setAssessments(filteredAssessments);

      // 4. Fetch Submissions
      const { data: subsData } = await supabase
        .from('assessment_submissions')
        .select('*')
        .or(`student_id.eq.${student.id},student_email.eq.${email}`);

      if (subsData) {
        const subMap: Record<string, Submission> = {};
        subsData.forEach(sub => {
          subMap[sub.assessment_id] = sub;
        });
        setSubmissions(subMap);
      }

    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Failed to load assessments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAssessments();
  };

  // ===== STATE HELPERS =====
  const getAssessmentState = (assessment: Assessment) => {
    const sub = submissions[assessment.id];
    const now = new Date();
    const isPastDue = assessment.due_date ? new Date(assessment.due_date) < now : false;

    if (sub) {
      if (sub.status === 'graded') return { key: 'graded', label: `Graded (${sub.score}/${assessment.total_points})`, color: THEME.success, icon: 'checkmark-done-circle' };
      if (sub.status === 'late') return { key: 'passed', label: 'Turned In Late', color: THEME.warning, icon: 'time' };
      return { key: 'passed', label: 'Turned In', color: THEME.info, icon: 'checkmark-circle' };
    }

    if (isPastDue) return { key: 'missing', label: 'Missing (Past Due)', color: THEME.danger, icon: 'alert-circle' };
    return { key: 'todo', label: 'Assigned', color: THEME.royalBlue, icon: 'clipboard' };
  };

  // ===== FILTERING & COUNTS =====
  const filteredAssessments = useMemo(() => {
    return assessments.filter(a => {
      const state = getAssessmentState(a);
      
      // Tab Filter
      if (activeTab !== 'all' && state.key !== activeTab) return false;

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = a.title?.toLowerCase().includes(q) || 
                      a.subject_name?.toLowerCase().includes(q) || 
                      a.description?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [assessments, submissions, activeTab, searchQuery]);

  const counts = useMemo(() => {
    let todo = 0, passed = 0, graded = 0, missing = 0;
    assessments.forEach(a => {
      const state = getAssessmentState(a);
      if (state.key === 'todo') todo++;
      if (state.key === 'passed') passed++;
      if (state.key === 'graded') graded++;
      if (state.key === 'missing') missing++;
    });
    return { all: assessments.length, todo, passed, graded, missing };
  }, [assessments, submissions]);

  // ===== MODAL OPEN & SUBMIT =====
  const openModal = (assessment: Assessment) => {
    setSelectedAssessment(assessment);
    
    const sub = submissions[assessment.id];
    setAnswerText(sub?.submission_text || '');
    setLinkUrl(sub?.link_url || '');
    setSelectedFile(null);
    setIsEditing(false);
    
    setModalVisible(true);
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets.length > 0) {
        setSelectedFile(res.assets[0]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleTurnIn = async () => {
    if (!selectedAssessment || !studentRow) return;

    if (!answerText.trim() && !linkUrl.trim() && !selectedFile && !submissions[selectedAssessment.id]?.file_url) {
      Alert.alert('Empty Submission', 'You haven\'t attached any files or written an answer. Turn in anyway?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn In', onPress: () => processSubmission() }
      ]);
      return;
    }

    processSubmission();
  };

  const processSubmission = async () => {
    if (!selectedAssessment || !studentRow) return;
    setIsSubmitting(true);

    try {
      let uploadedUrl = submissions[selectedAssessment.id]?.file_url || null;
      let uploadedName = submissions[selectedAssessment.id]?.file_name || null;

      // 1. Upload File if selected
      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop();
        const cleanName = `sub_${studentRow.id}_${Date.now()}.${ext}`;
        const filePath = `submissions/${cleanName}`;

        const response = await fetch(selectedFile.uri);
        const blob = await response.blob();

        const { error: upErr } = await supabase.storage
          .from('assessments')
          .upload(filePath, blob, {
            upsert: true,
            contentType: selectedFile.mimeType || 'application/octet-stream',
          });

        if (upErr) throw new Error(`File upload failed: ${upErr.message}`);

        const { data: urlData } = supabase.storage.from('assessments').getPublicUrl(filePath);
        uploadedUrl = urlData.publicUrl;
        uploadedName = selectedFile.name;
      }

      // 2. Determine Status (Late or Submitted)
      const now = new Date();
      const isLate = selectedAssessment.due_date && new Date(selectedAssessment.due_date) < now;
      const status = isLate ? 'late' : 'submitted';

      const payload = {
        assessment_id: selectedAssessment.id,
        student_id: studentRow.id,
        student_name: studentName,
        student_email: studentRow.email || '',
        status: status,
        submission_text: answerText.trim() || null,
        file_url: uploadedUrl,
        file_name: uploadedName,
        link_url: linkUrl.trim() || null,
        submitted_at: now.toISOString(),
        updated_at: now.toISOString(),
        created_at: now.toISOString(), // ✅ Added to payload
      };

      const existingSub = submissions[selectedAssessment.id];

      if (existingSub) {
        // Update existing submission (strip created_at so we don't overwrite)
        const { created_at, ...updatePayload } = payload;
        
        const { data, error } = await supabase
          .from('assessment_submissions')
          .update(updatePayload)
          .eq('id', existingSub.id)
          .select();

        if (error) throw error;
        setSubmissions(prev => ({ ...prev, [selectedAssessment.id]: data[0] }));
        Alert.alert('Success', 'Assessment updated and turned in!');
      } else {
        // Insert new submission
        const { data, error } = await supabase
          .from('assessment_submissions')
          .insert([payload])
          .select();

        if (error) throw error;
        setSubmissions(prev => ({ ...prev, [selectedAssessment.id]: data[0] }));
        
        // Notify Teacher
        if (selectedAssessment.teacher_id) {
          await supabase.from('notifications').insert([{
            user_id: selectedAssessment.teacher_id,
            role: 'teacher',
            title: `Work Turned In: ${selectedAssessment.title}`,
            message: `${studentName} turned in their assessment for ${selectedAssessment.subject_name}.`,
            type: 'submission',
            read: false,
            is_read: false,
            created_at: now.toISOString()
          }]);
        }
        
        Alert.alert('Success', 'Assessment turned in successfully!');
      }

      setModalVisible(false);
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Failed to submit assessment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnsubmit = () => {
    Alert.alert(
      'Unsubmit Work',
      'Unsubmit to add or change your work? You can pass again anytime before the teacher grades it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unsubmit', onPress: () => setIsEditing(true) }
      ]
    );
  };

  // ===== RENDER =====
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

  const currentSub = selectedAssessment ? submissions[selectedAssessment.id] : null;
  const currentState = selectedAssessment ? getAssessmentState(selectedAssessment) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.royalBlue} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.royalBlue} />
          </TouchableOpacity>
          <Text style={styles.title}>Assessments</Text>
          <TouchableOpacity onPress={loadAssessments} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={THEME.royalBlue} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={THEME.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search assessments..."
            placeholderTextColor={THEME.gray}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {[
            { key: 'all', label: `All (${counts.all})` },
            { key: 'todo', label: `To Do (${counts.todo})` },
            { key: 'passed', label: `Turned In (${counts.passed})` },
            { key: 'graded', label: `Graded (${counts.graded})` },
            { key: 'missing', label: `Missing (${counts.missing})` },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabChip, activeTab === t.key && styles.tabChipActive]}
              onPress={() => setActiveTab(t.key as any)}
            >
              <Text style={[styles.tabChipText, activeTab === t.key && styles.tabChipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Assessment List */}
        {filteredAssessments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={44} color={THEME.gray} />
            <Text style={styles.emptyText}>All Caught Up</Text>
            <Text style={styles.emptySub}>You don't have any assessments in this tab.</Text>
          </View>
        ) : (
          filteredAssessments.map(item => {
            const state = getAssessmentState(item);
            const typeIcon = item.type?.toLowerCase().includes('quiz') ? 'help-circle' : 
                             item.type?.toLowerCase().includes('activity') ? 'pencil' : 
                             item.type?.toLowerCase().includes('project') ? 'git-network' : 'document-text';

            return (
              <TouchableOpacity key={item.id} style={styles.card} onPress={() => openModal(item)}>
                <View style={styles.cardHeader}>
                  <View style={styles.subjectTag}>
                    <Ionicons name={typeIcon as any} size={12} color={THEME.royalBlue} />
                    <Text style={styles.subjectTagText}>{item.subject_name || 'General'}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: state.color + '15' }]}>
                    <Ionicons name={state.icon as any} size={12} color={state.color} />
                    <Text style={[styles.statusBadgeText, { color: state.color }]}>{state.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardTeacher}>Teacher: {item.teacher_name || 'Teacher'}</Text>
                
                <View style={styles.cardFooter}>
                  <Text style={styles.cardDue}>
                    <Ionicons name="calendar" size={12} /> {item.due_date ? new Date(item.due_date).toLocaleDateString() : 'No due date'}
                  </Text>
                  <Text style={styles.cardPoints}>{item.total_points || 100} pts</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ===== CLASSROOM MODAL ===== */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalSafe}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalSubject}>{selectedAssessment?.subject_name || 'Classwork'}</Text>
              <Text style={styles.modalTitle} numberOfLines={1}>{selectedAssessment?.title}</Text>
            </View>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={THEME.black} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            {/* Teacher Instructions */}
            <View style={styles.instructionsCard}>
              <View style={styles.badgeRow}>
                <View style={styles.pill}><Text style={styles.pillText}>{selectedAssessment?.type || 'Assignment'}</Text></View>
                <Text style={styles.dueText}>
                  Due: {selectedAssessment?.due_date ? new Date(selectedAssessment.due_date).toLocaleString() : 'None'}
                </Text>
              </View>
              <Text style={styles.instructionTitle}>Instructions</Text>
              <Text style={styles.instructionBody}>{selectedAssessment?.description || 'No detailed instructions provided.'}</Text>
              
              {selectedAssessment?.attachment_url && (
                <TouchableOpacity style={styles.attachmentBtn} onPress={() => Linking.openURL(selectedAssessment.attachment_url!)}>
                  <Ionicons name="document-attach" size={16} color={THEME.royalBlue} />
                  <Text style={styles.attachmentBtnText}>{selectedAssessment.attachment_name || 'View Attached Resource'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Your Work Section */}
            <Text style={styles.sectionHeading}>Your Work</Text>
            
            <View style={styles.workCard}>
              <View style={[styles.statusBadge, { backgroundColor: currentState?.color + '15', alignSelf: 'flex-start', marginBottom: 12 }]}>
                <Ionicons name={currentState?.icon as any} size={14} color={currentState?.color} />
                <Text style={[styles.statusBadgeText, { color: currentState?.color }]}>{currentState?.label}</Text>
              </View>

              {/* Graded View */}
              {currentSub?.status === 'graded' && (
                <View style={styles.gradedBox}>
                  <Text style={styles.gradedScore}>{currentSub.score} / {selectedAssessment?.total_points}</Text>
                  <Text style={styles.gradedLabel}>Teacher Feedback:</Text>
                  <Text style={styles.gradedFeedback}>{currentSub.feedback || 'No feedback provided.'}</Text>
                </View>
              )}

              {/* Turned In View (Not Editing) */}
              {currentSub && currentSub.status !== 'graded' && !isEditing && (
                <View>
                  <Text style={styles.submittedDate}>Turned in on {new Date(currentSub.submitted_at).toLocaleString()}</Text>
                  
                  {currentSub.submission_text && (
                    <View style={styles.submittedItem}>
                      <Text style={styles.submittedLabel}>Written Response:</Text>
                      <Text style={styles.submittedText}>{currentSub.submission_text}</Text>
                    </View>
                  )}
                  {currentSub.file_url && (
                    <TouchableOpacity style={styles.submittedFile} onPress={() => Linking.openURL(currentSub.file_url!)}>
                      <Ionicons name="document" size={16} color={THEME.royalBlue} />
                      <Text style={styles.submittedFileText}>{currentSub.file_name || 'Attached File'}</Text>
                    </TouchableOpacity>
                  )}
                  {currentSub.link_url && (
                    <TouchableOpacity style={styles.submittedFile} onPress={() => Linking.openURL(currentSub.link_url!)}>
                      <Ionicons name="link" size={16} color={THEME.info} />
                      <Text style={[styles.submittedFileText, { color: THEME.info }]}>{currentSub.link_url}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.unsubmitBtn} onPress={handleUnsubmit}>
                    <Ionicons name="refresh" size={16} color={THEME.danger} />
                    <Text style={styles.unsubmitBtnText}>Unsubmit / Edit Work</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Submission Form (New or Editing) */}
              {(!currentSub || isEditing) && currentSub?.status !== 'graded' && (
                <View>
                  <Text style={styles.inputLabel}>Your Answer (Optional)</Text>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    numberOfLines={4}
                    placeholder="Type your answer here..."
                    value={answerText}
                    onChangeText={setAnswerText}
                  />

                  <Text style={styles.inputLabel}>Link URL (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://..."
                    value={linkUrl}
                    onChangeText={setLinkUrl}
                  />

                  <TouchableOpacity style={styles.filePickerBtn} onPress={pickFile}>
                    <Ionicons name="cloud-upload" size={20} color={THEME.royalBlue} />
                    <Text style={styles.filePickerText}>{selectedFile ? selectedFile.name : 'Attach a File (PDF, Image, Doc)'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.turnInBtn} onPress={handleTurnIn} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <ActivityIndicator color={THEME.white} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={18} color={THEME.white} />
                        <Text style={styles.turnInBtnText}>{isEditing ? 'Re-submit Assessment' : 'Turn In Assessment'}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  
                  {isEditing && (
                    <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setIsEditing(false)}>
                      <Text style={styles.cancelEditBtnText}>Cancel Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Sidebar */}
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
  
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: THEME.white,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  searchInput: { flex: 1, fontSize: 13, color: THEME.black },
  
  tabChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: THEME.white, borderWidth: 1, borderColor: THEME.offWhiteDark, marginRight: 8,
  },
  tabChipActive: { backgroundColor: THEME.royalBlue, borderColor: THEME.royalBlue },
  tabChipText: { fontSize: 12, fontWeight: '600', color: THEME.darkGray },
  tabChipTextActive: { color: THEME.white },

  // Card
  card: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    borderLeftWidth: 4, borderLeftColor: THEME.royalBlue,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subjectTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: THEME.offWhite, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  subjectTagText: { fontSize: 10, fontWeight: '700', color: THEME.royalBlue },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: '700' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: THEME.black, marginBottom: 4 },
  cardTeacher: { fontSize: 12, color: THEME.gray, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: THEME.offWhiteDark, paddingTop: 10 },
  cardDue: { fontSize: 11, color: THEME.darkGray, fontWeight: '600' },
  cardPoints: { fontSize: 11, color: THEME.gray, fontWeight: '600' },

  // Empty
  emptyContainer: { alignItems: 'center', padding: 40, marginTop: 20 },
  emptyText: { fontSize: 16, fontWeight: '700', color: THEME.black, marginTop: 12 },
  emptySub: { fontSize: 13, color: THEME.gray, textAlign: 'center', marginTop: 4 },

  // Modal
  modalSafe: { flex: 1, backgroundColor: THEME.offWhite },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: THEME.white,
    borderBottomWidth: 1, borderBottomColor: THEME.offWhiteDark,
  },
  modalSubject: { fontSize: 12, fontWeight: '700', color: THEME.royalBlue, textTransform: 'uppercase' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: THEME.black },
  closeBtn: { padding: 4 },
  
  instructionsCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pill: { backgroundColor: THEME.royalBlue + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pillText: { fontSize: 10, fontWeight: '700', color: THEME.royalBlue },
  dueText: { fontSize: 12, color: THEME.danger, fontWeight: '600' },
  instructionTitle: { fontSize: 14, fontWeight: '700', color: THEME.black, marginBottom: 6 },
  instructionBody: { fontSize: 13, color: THEME.darkGray, lineHeight: 20 },
  attachmentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: THEME.offWhite,
    padding: 10, borderRadius: 8, marginTop: 12,
  },
  attachmentBtnText: { fontSize: 12, fontWeight: '600', color: THEME.royalBlue },

  sectionHeading: { fontSize: 16, fontWeight: '800', color: THEME.black, marginBottom: 12 },
  workCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },

  // Graded
  gradedBox: { backgroundColor: THEME.success + '10', padding: 16, borderRadius: 12, marginBottom: 12 },
  gradedScore: { fontSize: 24, fontWeight: '800', color: THEME.success, marginBottom: 4 },
  gradedLabel: { fontSize: 12, fontWeight: '700', color: THEME.success, marginTop: 8 },
  gradedFeedback: { fontSize: 13, color: THEME.darkGray, fontStyle: 'italic', marginTop: 4 },

  // Submitted
  submittedDate: { fontSize: 12, color: THEME.gray, marginBottom: 12 },
  submittedItem: { marginBottom: 12 },
  submittedLabel: { fontSize: 11, fontWeight: '700', color: THEME.gray, textTransform: 'uppercase', marginBottom: 4 },
  submittedText: { fontSize: 13, color: THEME.black, backgroundColor: THEME.offWhite, padding: 10, borderRadius: 8 },
  submittedFile: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: THEME.white,
    borderWidth: 1, borderColor: THEME.offWhiteDark, borderRadius: 8, padding: 10, marginBottom: 8,
  },
  submittedFileText: { fontSize: 12, fontWeight: '600', color: THEME.royalBlue, flex: 1 },
  unsubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: THEME.danger + '10', padding: 12, borderRadius: 10, marginTop: 12,
  },
  unsubmitBtnText: { fontSize: 13, fontWeight: '700', color: THEME.danger },

  // Form
  inputLabel: { fontSize: 12, fontWeight: '700', color: THEME.darkGray, marginBottom: 6 },
  textArea: {
    backgroundColor: THEME.offWhite, borderRadius: 10, padding: 12, fontSize: 14,
    minHeight: 100, textAlignVertical: 'top', marginBottom: 16, borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  textInput: {
    backgroundColor: THEME.offWhite, borderRadius: 10, padding: 12, fontSize: 14,
    marginBottom: 16, borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  filePickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 2, borderStyle: 'dashed', borderColor: THEME.royalBlue + '40',
    backgroundColor: THEME.royalBlue + '05', padding: 16, borderRadius: 12, marginBottom: 20,
  },
  filePickerText: { fontSize: 13, fontWeight: '600', color: THEME.royalBlue },
  turnInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: THEME.royalBlue, padding: 14, borderRadius: 12,
  },
  turnInBtnText: { fontSize: 14, fontWeight: '700', color: THEME.white },
  cancelEditBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
  cancelEditBtnText: { fontSize: 13, fontWeight: '600', color: THEME.gray },
});