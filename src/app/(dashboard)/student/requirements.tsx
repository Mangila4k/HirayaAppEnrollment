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

// ===== REQUIREMENT DEFINITIONS =====
const REQUIREMENT_DEFS = [
  {
    key: 'two_by_two_picture',
    code: 'REQ-1',
    title: '2x2 ID Picture (White Background)',
    description: 'Recent 2x2 colored ID picture taken in formal attire with plain white background.',
    dbField: 'two_by_two_picture_url',
  },
  {
    key: 'psa_birth',
    code: 'REQ-2',
    title: 'PSA Official Birth Certificate',
    description: 'Original or clear photocopy of Philippine Statistics Authority (PSA) Birth Certificate.',
    dbField: 'psa_birth_url',
  },
  {
    key: 'report_card',
    code: 'REQ-3',
    title: 'Report Card (Form 138)',
    description: 'Original Report Card from previous grade level signed by the Principal.',
    dbField: 'form_138_url',
  },
  {
    key: 'good_moral',
    code: 'REQ-4',
    title: 'Certificate of Good Moral Character',
    description: 'Official Certificate of Good Moral Character issued by previous school.',
    dbField: 'good_moral_url',
  },
];

type RequirementState = {
  key: string;
  code: string;
  title: string;
  description: string;
  dbField: string;
  fileUrl: string | null;
  isSubmitted: boolean;
  status: string;
};

export default function StudentRequirements() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [studentRow, setStudentRow] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);
  const [sectionName, setSectionName] = useState<string>('Unassigned');
  const [requirements, setRequirements] = useState<RequirementState[]>([]);

  // Modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [selectedReq, setSelectedReq] = useState<RequirementState | null>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadRequirementsData();
  }, []);

  const loadRequirementsData = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error('No user email found');

      // 1. Fetch Student
      let student: any = null;
      const { data: userData } = await supabase
        .from('users').select('student_id').eq('email', email).maybeSingle();

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

      // ===== 2. SECTION from sections table =====
      const sectionId =
        student.section_id ||
        student.sectionId  ||
        student.section    ||
        null;

      let secName = 'Unassigned';
      if (sectionId) {
        const { data: sec } = await supabase
          .from('sections')
          .select('*')
          .eq('id', sectionId)
          .maybeSingle();
        if (sec) {
          secName = sec.name || sec.section_name || sec.section || 'Unassigned';
        }
      } else if (student.section_name) {
        secName = student.section_name;
      }
      setSectionName(secName);

      // 3. Fetch Enrollment
      let enroll: any = null;
      try {
        let q = supabase.from('enrollments').select('*');
        if (email && student.id) {
          q = q.or(`email.eq.${email},student_id.eq.${student.id}`);
        } else if (email) {
          q = q.eq('email', email);
        }
        const { data: eRows } = await q.order('created_at', { ascending: false }).limit(1);
        if (eRows && eRows.length > 0) enroll = eRows[0];
      } catch(e) {}
      setEnrollment(enroll);

      // 4. Fetch Student Documents
      let uploadedDocs: any[] = [];
      try {
        const { data: docs } = await supabase
          .from('student_documents')
          .select('*')
          .eq('student_id', student.id);
        if (docs) uploadedDocs = docs;
      } catch(e) {}

      // 5. Assemble requirements
      const assembled = REQUIREMENT_DEFS.map(def => {
        let fileUrl = student[def.dbField] || null;
        let isSubmitted = !!fileUrl;
        let status = isSubmitted ? 'Verified' : 'Missing';

        const docMatch = uploadedDocs.find(d =>
          d.document_type === def.title ||
          d.document_type === def.key ||
          (d.document_type && d.document_type.toLowerCase().includes(def.title.toLowerCase()))
        );

        if (docMatch) {
          fileUrl = docMatch.file_url || fileUrl;
          isSubmitted = true;
          status = docMatch.verified ? 'Verified' : (docMatch.status || 'Under Review');
        }

        return {
          ...def,
          fileUrl,
          isSubmitted,
          status,
        };
      });

      setRequirements(assembled);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Failed to load requirements');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRequirementsData();
  };

  const openUploadModal = (req: RequirementState) => {
    setSelectedReq(req);
    setSelectedFile(null);
    setUploadModalVisible(true);
  };

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets.length > 0) {
        setSelectedFile(res.assets[0]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedReq || !studentRow) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name?.split('.').pop() || 'pdf';
      const fileName = `${studentRow.id}_${selectedReq.key}_${Date.now()}.${fileExt}`;
      const filePath = `student_requirements/${fileName}`;

      const response = await fetch(selectedFile.uri);
      const blob = await response.blob();

      const { error: upErr } = await supabase.storage
        .from('student_documents')
        .upload(filePath, blob, {
          upsert: true,
          contentType: selectedFile.mimeType || 'application/octet-stream',
        });

      if (upErr) throw new Error(`Storage Error: ${upErr.message}. Make sure the "student_documents" bucket exists and is Public.`);

      const { data: urlData } = supabase.storage
        .from('student_documents')
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      const updateObj: any = {};
      updateObj[selectedReq.dbField] = fileUrl;

      const { error: studentErr } = await supabase
        .from('students')
        .update(updateObj)
        .eq('id', studentRow.id);

      if (studentErr) console.warn('Failed to update student table, but file was uploaded:', studentErr);

      try {
        await supabase.from('student_documents').upsert({
          student_id: studentRow.id,
          document_type: selectedReq.key,
          file_url: fileUrl,
          verified: false,
          status: 'Under Review'
        });
      } catch(e) {
        console.warn('Could not upsert to student_documents table');
      }

      Alert.alert('Success', `${selectedReq.title} uploaded successfully!`);
      setUploadModalVisible(false);
      loadRequirementsData();

    } catch (e: any) {
      console.error(e);
      Alert.alert('Upload Failed', e?.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // ===== STATS =====
  const stats = useMemo(() => {
    const total = requirements.length;
    const submitted = requirements.filter(r => r.isSubmitted).length;
    return { total, submitted, missing: total - submitted };
  }, [requirements]);

  // ===== UI HELPERS =====
  const getStatusColor = (status: string) => {
    if (status === 'Verified') return { bg: '#DCFCE7', text: '#15803D', icon: 'checkmark-circle' };
    if (status === 'Under Review') return { bg: '#FEF3C7', text: '#B45309', icon: 'time' };
    return { bg: '#FEE2E2', text: '#B91C1C', icon: 'alert-circle' };
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.royalBlue} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.royalBlue} />
          </TouchableOpacity>
          <Text style={styles.title}>Requirements</Text>
          <TouchableOpacity onPress={loadRequirementsData} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={THEME.royalBlue} />
          </TouchableOpacity>
        </View>

        <Text style={styles.pageHeading}>Enrollment Requirements</Text>
        <Text style={styles.pageSub}>View and submit your required documents.</Text>

        {/* Class Info Card */}
        {(enrollment || studentRow) && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="school" size={24} color={THEME.royalBlue} />
              <Text style={styles.infoTitle}>Current Enrollment</Text>
            </View>
            <View style={styles.infoGrid}>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Grade</Text>
                <Text style={styles.infoVal}>{studentRow?.grade_level || enrollment?.grade_level || 'N/A'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Section</Text>
                <Text style={styles.infoVal}>{sectionName}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Strand</Text>
                <Text style={styles.infoVal}>{studentRow?.strand || enrollment?.strand || 'N/A'}</Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={styles.infoLabel}>Status</Text>
                <Text style={[styles.infoVal, { color: THEME.success, textTransform: 'capitalize' }]}>
                  {enrollment?.status || 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLbl}>TOTAL REQS</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: THEME.success }]}>{stats.submitted}</Text>
            <Text style={styles.statLbl}>SUBMITTED</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: THEME.danger }]}>{stats.missing}</Text>
            <Text style={styles.statLbl}>MISSING</Text>
          </View>
        </View>

        {/* Requirements List */}
        <Text style={styles.sectionTitle}>REQUIRED DOCUMENTS</Text>

        {requirements.map((req) => {
          const statusInfo = getStatusColor(req.status);
          return (
            <View key={req.key} style={styles.reqCard}>
              <View style={styles.reqHeader}>
                <View style={styles.reqTitleCol}>
                  <Text style={styles.reqCode}>{req.code}</Text>
                  <Text style={styles.reqTitle}>{req.title}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                  <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.text} />
                  <Text style={[styles.statusText, { color: statusInfo.text }]}>{req.status}</Text>
                </View>
              </View>

              <Text style={styles.reqDesc}>{req.description}</Text>

              <View style={styles.reqFooter}>
                {req.isSubmitted && req.fileUrl ? (
                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => Linking.openURL(req.fileUrl!)}
                  >
                    <Ionicons name="eye" size={14} color={THEME.royalBlue} />
                    <Text style={styles.viewBtnText}>View Document</Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => openUploadModal(req)}
                >
                  <Ionicons name="cloud-upload" size={14} color={THEME.white} />
                  <Text style={styles.uploadBtnText}>
                    {req.isSubmitted ? 'Re-upload' : 'Upload'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Help Card */}
        <View style={styles.helpCard}>
          <Ionicons name="headset" size={32} color={THEME.royalBlue} />
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpSub}>Contact the registrar's office for assistance with your requirements.</Text>
          <View style={styles.helpContacts}>
            <Text style={styles.helpContactText}><Ionicons name="call" size={12} /> (032) 123-4567</Text>
            <Text style={styles.helpContactText}><Ionicons name="mail" size={12} /> registrar@hes.edu.ph</Text>
          </View>
        </View>

      </ScrollView>

      {/* ===== UPLOAD MODAL ===== */}
      <Modal visible={uploadModalVisible} transparent animationType="slide" onRequestClose={() => setUploadModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Requirement</Text>
              <TouchableOpacity onPress={() => setUploadModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={THEME.white} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <Text style={styles.modalReqTitle}>{selectedReq?.title}</Text>
              <Text style={styles.modalReqDesc}>Allowed: PDF, JPG, PNG (Max 5MB)</Text>

              <TouchableOpacity style={styles.filePicker} onPress={pickFile}>
                <Ionicons name="cloud-upload" size={24} color={THEME.royalBlue} />
                <Text style={styles.filePickerText}>
                  {selectedFile ? selectedFile.name : 'Choose File'}
                </Text>
              </TouchableOpacity>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.cancelBtn]}
                  onPress={() => setUploadModalVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.submitBtn]}
                  onPress={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={THEME.white} size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>Upload</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

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
    marginBottom: 12, paddingTop: 12,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.offWhite,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },
  title: { fontSize: 18, fontWeight: '700', color: THEME.black },
  pageHeading: { fontSize: 22, fontWeight: '800', color: THEME.royalBlue, marginTop: 8 },
  pageSub: { fontSize: 13, color: THEME.gray, marginTop: 4, marginBottom: 16 },

  infoCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: THEME.black },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  infoCol: { width: '47%' },
  infoLabel: { fontSize: 10, fontWeight: '700', color: THEME.gray, textTransform: 'uppercase' },
  infoVal: { fontSize: 13, fontWeight: '600', color: THEME.black, marginTop: 2 },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: THEME.white, paddingVertical: 14, paddingHorizontal: 8,
    borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  statNum: { fontSize: 22, fontWeight: '800', color: THEME.royalBlue },
  statLbl: { fontSize: 9, fontWeight: '700', color: THEME.gray, marginTop: 4 },

  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: THEME.gray, letterSpacing: 1,
    marginBottom: 12, marginTop: 4,
  },

  reqCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  reqHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8,
  },
  reqTitleCol: { flex: 1, paddingRight: 8 },
  reqCode: { fontSize: 10, fontWeight: '700', color: THEME.gray, marginBottom: 2 },
  reqTitle: { fontSize: 14, fontWeight: '700', color: THEME.black },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  statusText: { fontSize: 10, fontWeight: '700' },
  reqDesc: { fontSize: 12, color: THEME.darkGray, marginBottom: 14, lineHeight: 18 },

  reqFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: THEME.offWhiteDark, paddingTop: 10,
  },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: THEME.royalBlue + '10',
  },
  viewBtnText: { fontSize: 11, fontWeight: '700', color: THEME.royalBlue },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: THEME.royalBlue,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  uploadBtnText: { fontSize: 11, fontWeight: '700', color: THEME.white },

  helpCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 20, marginTop: 10,
    borderWidth: 1, borderColor: THEME.offWhiteDark, alignItems: 'center',
  },
  helpTitle: { fontSize: 16, fontWeight: '700', color: THEME.black, marginTop: 10 },
  helpSub: { fontSize: 13, color: THEME.gray, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  helpContacts: { flexDirection: 'row', gap: 16 },
  helpContactText: { fontSize: 12, color: THEME.darkGray, fontWeight: '600' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(26,32,44,0.6)', justifyContent: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: THEME.offWhite, borderRadius: 20, overflow: 'hidden',
    shadowColor: THEME.darkShadow, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  modalHeader: {
    backgroundColor: THEME.royalBlue, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: THEME.white },
  modalClose: { padding: 4 },

  modalReqTitle: { fontSize: 15, fontWeight: '700', color: THEME.black, marginBottom: 4 },
  modalReqDesc: { fontSize: 12, color: THEME.gray, marginBottom: 20 },

  filePicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 24, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 2, borderStyle: 'dashed', borderColor: THEME.offWhiteDark,
    backgroundColor: THEME.white, marginBottom: 20,
  },
  filePickerText: { fontSize: 14, fontWeight: '600', color: THEME.royalBlue },

  modalBtnRow: { flexDirection: 'row', gap: 10 },
  modalBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { backgroundColor: THEME.white, borderWidth: 1, borderColor: THEME.offWhiteDark },
  cancelBtnText: { fontSize: 14, fontWeight: '700', color: THEME.darkGray },
  submitBtn: { backgroundColor: THEME.royalBlue },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: THEME.white },
});