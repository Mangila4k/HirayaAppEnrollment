import StudentSidebar from '@/components/StudentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  warning: '#F59E0B',
  info: '#3B82F6',
  danger: '#EF4444',
};

type ScheduleItem = {
  id: string;
  day: string;
  subject: string;
  teacher: string;
  room: string;
  start_time: string;
  end_time: string;
};

const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentSchedule() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const [student, setStudent] = useState<any>(null);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  
  const [sectionName, setSectionName] = useState('Loading...');
  const [grade, setGrade] = useState('Grade 11');
  const [strand, setStrand] = useState('N/A');
  const [schoolYear, setSchoolYear] = useState('2025-2026');
  
  // Document fallback state
  const [uploadedDoc, setUploadedDoc] = useState<{
    url: string;
    name: string;
    type: string;
    isImage: boolean;
    isGoogleDocs: boolean;
  } | null>(null);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error('No email found');

      // 1. Fetch student
      let sRow: any = null;
      const { data: userData } = await supabase
        .from('users').select('student_id').eq('email', email).maybeSingle();

      if (userData?.student_id) {
        const { data } = await supabase.from('students').select('*').eq('id', userData.student_id).maybeSingle();
        sRow = data;
      }
      if (!sRow) {
        const { data } = await supabase.from('students').select('*').eq('email', email).maybeSingle();
        sRow = data;
      }

      if (!sRow) throw new Error('Student record not found');
      setStudent(sRow);

      // 2. GRADE LEVEL & STRAND
      setGrade(sRow.grade_level || 'Grade 11');
      setStrand(sRow.strand || 'N/A');
      setSchoolYear('2025-2026');

      // 3. SECTION from sections table
      const sectionId = sRow.section_id || sRow.sectionId || sRow.section || null;
      let sectionRecord: any = null;

      if (sectionId) {
        const { data: secData } = await supabase
          .from('sections')
          .select('*')
          .eq('id', sectionId)
          .maybeSingle();
        if (secData) sectionRecord = secData;
      }

      if (sectionRecord) {
        setSectionName(sectionRecord.name || sectionRecord.section_name || 'N/A');
        
        // 4. Check for uploaded document
        if (sectionRecord.schedule_doc_url && sectionRecord.shared_at) {
          const isGDocs = sectionRecord.schedule_doc_type === 'google_docs' ||
                          (sectionRecord.schedule_doc_url || '').includes('docs.google.com') ||
                          (sectionRecord.schedule_doc_url || '').includes('drive.google.com');
          const isImg = (sectionRecord.schedule_doc_type || '').startsWith('image/') ||
                        /\.(png|jpe?g|webp|gif)$/i.test(sectionRecord.schedule_doc_name || '') ||
                        (sectionRecord.schedule_doc_url && sectionRecord.schedule_doc_url.startsWith('data:image/'));

          setUploadedDoc({
            url: sectionRecord.schedule_doc_url,
            name: sectionRecord.schedule_doc_name || (isGDocs ? 'Official Student Load (Google Docs)' : isImg ? 'Student Load Schedule Image' : 'Student Load Schedule PDF'),
            type: sectionRecord.schedule_doc_type || (isGDocs ? 'google_docs' : isImg ? 'image/png' : 'application/pdf'),
            isImage: isImg,
            isGoogleDocs: isGDocs,
          });
        } else {
          setUploadedDoc(null);
        }
      } else if (sRow.section_name) {
        setSectionName(sRow.section_name);
      }

      // 5. Fetch Schedules (if no uploaded doc)
      const [{ data: schedData }, { data: subjectsData }, { data: usersData }] = await Promise.all([
        supabase.from('schedules').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('users').select('id, first_name, last_name, email, role')
      ]);

      if (schedData && schedData.length > 0) {
        let filtered = schedData;
        if (sectionId) {
          const secFiltered = schedData.filter(s => s.section_id === sectionId);
          if (secFiltered.length > 0) filtered = secFiltered;
        }

        const formatted: ScheduleItem[] = filtered.map(s => {
          let subName = s.subject || s.subject_name || s.subject_title || s.name || s.subject_code;
          if (!subName && s.subject_id) {
            const foundSub = subjectsData?.find(sub => sub.id === s.subject_id || sub.code === s.subject_id);
            if (foundSub) subName = foundSub.name || foundSub.title;
          }

          let teacherName = s.teacher || s.teacher_name;
          if (!teacherName && s.teacher_id) {
            const foundUser = usersData?.find(u => u.id === s.teacher_id);
            if (foundUser) teacherName = `${foundUser.first_name || ''} ${foundUser.last_name || ''}`.trim() || foundUser.email;
          }

          return {
            id: s.id,
            day: s.day || 'Monday',
            subject: subName || 'General Subject',
            teacher: teacherName || '',
            room: s.room || s.room_name || 'Room 101',
            start_time: s.start_time || '07:30',
            end_time: s.end_time || '08:30',
          };
        });

        formatted.sort((a, b) => a.start_time.localeCompare(b.start_time));
        setSchedules(formatted);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    if (/am|pm/i.test(timeStr)) return timeStr.trim();
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      let hour = parseInt(parts[0], 10);
      const minute = parts[1].padStart(2, '0');
      if (isNaN(hour)) return timeStr;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${minute} ${ampm}`;
    }
    return timeStr;
  };

  const handleOpenDoc = () => {
    if (!uploadedDoc) return;
    Linking.openURL(uploadedDoc.url).catch(() => Alert.alert('Error', 'Could not open document link.'));
  };

  const todaysClasses = useMemo(() => {
    const todayIndex = new Date().getDay();
    const currentDayName = (todayIndex >= 1 && todayIndex <= 5) ? dayNames[todayIndex] : 'Monday';
    return {
      name: currentDayName,
      classes: schedules.filter(s => (s.day || '').toLowerCase() === currentDayName.toLowerCase())
    };
  }, [schedules]);

  const groupedSchedules = useMemo(() => {
    const grouped: Record<string, ScheduleItem[]> = {};
    daysOrder.forEach(d => grouped[d] = []);
    schedules.forEach(s => {
      const matchDay = daysOrder.find(d => d.toLowerCase() === s.day.toLowerCase());
      if (matchDay) grouped[matchDay].push(s);
    });
    return grouped;
  }, [schedules]);

  const uniqueSubjects = useMemo(() => [...new Set(schedules.map(s => s.subject).filter(Boolean))], [schedules]);
  const uniqueTeachers = useMemo(() => [...new Set(schedules.map(s => s.teacher).filter(Boolean))], [schedules]);

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
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.royalBlue} />
          </TouchableOpacity>
          <Text style={styles.title}>Class Program</Text>
          <TouchableOpacity onPress={loadSchedule} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={THEME.royalBlue} />
          </TouchableOpacity>
        </View>

        {/* Section Info Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="people" size={24} color={THEME.royalBlue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionName}>{sectionName}</Text>
              <Text style={styles.sectionSub}>Your assigned section and class details</Text>
            </View>
          </View>
          <View style={styles.sectionMetaRow}>
            <Text style={styles.sectionMeta}><Text style={{fontWeight:'700'}}>Grade:</Text> {grade}</Text>
            <Text style={styles.sectionMeta}><Text style={{fontWeight:'700'}}>Strand:</Text> {strand}</Text>
            <Text style={styles.sectionMeta}><Text style={{fontWeight:'700'}}>S.Y.:</Text> {schoolYear}</Text>
            <Text style={styles.sectionMeta}><Text style={{fontWeight:'700'}}>Classes:</Text> {schedules.length}</Text>
          </View>
        </View>

        {/* ===== OFFICIAL UPLOADED SCHEDULE FALLBACK ===== */}
        {uploadedDoc ? (
          <View style={styles.docCard}>
            <View style={styles.docHeader}>
              <View style={[styles.docIcon, { backgroundColor: uploadedDoc.isGoogleDocs ? '#E8F0FE' : uploadedDoc.isImage ? '#ECFDF5' : '#FEF2F2' }]}>
                <Ionicons 
                  name={uploadedDoc.isGoogleDocs ? 'logo-google' : uploadedDoc.isImage ? 'image' : 'document-text'} 
                  size={24} 
                  color={uploadedDoc.isGoogleDocs ? '#4285F4' : uploadedDoc.isImage ? THEME.success : THEME.danger} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.docTitle}>
                  {uploadedDoc.isGoogleDocs ? 'Official Google Docs Student Load' : uploadedDoc.isImage ? 'Official Schedule Image' : 'Official PDF Student Load'}
                </Text>
                <Text style={styles.docSub} numberOfLines={2}>
                  Your teacher sent the official section student load schedule. Individual timetable slots have not been entered into the grid yet.
                </Text>
              </View>
            </View>

            <View style={styles.docFileBox}>
              <Ionicons name="document-attach" size={18} color={THEME.royalBlue} />
              <Text style={styles.docFileName} numberOfLines={1}>{uploadedDoc.name}</Text>
            </View>

            <TouchableOpacity style={styles.viewDocBtn} onPress={handleOpenDoc}>
              <Text style={styles.viewDocBtnText}>View Full Schedule</Text>
              <Ionicons name="open-outline" size={18} color={THEME.white} />
            </TouchableOpacity>
          </View>
        ) : (
          // ===== REGULAR TIMETABLE FALLBACK =====
          <>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{schedules.length}</Text>
                <Text style={styles.statLbl}>TOTAL CLASSES</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{uniqueSubjects.length}</Text>
                <Text style={styles.statLbl}>SUBJECTS</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{uniqueTeachers.length}</Text>
                <Text style={styles.statLbl}>TEACHERS</Text>
              </View>
            </View>

            {/* Today's Classes */}
            <View style={styles.todayCard}>
              <View style={styles.todayHeader}>
                <Ionicons name="sunny" size={24} color={THEME.yellow} />
                <Text style={styles.todayTitle}>Today's Classes - {todaysClasses.name}</Text>
              </View>

              {todaysClasses.classes.length === 0 ? (
                <Text style={styles.emptyToday}>No classes scheduled for today.</Text>
              ) : (
                todaysClasses.classes.map(c => (
                  <View key={c.id} style={styles.todayClassItem}>
                    <View style={styles.todayTime}>
                      <Text style={styles.todayTimeText}>{formatTime(c.start_time)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.todaySubject}>{c.subject}</Text>
                      <Text style={styles.todayMeta}>
                        <Ionicons name="location" size={11} /> {c.room}
                        {c.teacher ? ` • ` : ''}
                        {c.teacher ? <><Ionicons name="person" size={11} /> {c.teacher}</> : null}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Weekly Schedule List */}
            <Text style={styles.sectionTitle}>WEEKLY CLASS PROGRAM</Text>

            {schedules.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={44} color={THEME.gray} />
                <Text style={styles.emptyText}>No Class Program Published Yet</Text>
                <Text style={styles.emptySub}>Please wait for your adviser to upload the schedule.</Text>
              </View>
            ) : (
              daysOrder.map(day => {
                const classes = groupedSchedules[day];
                if (classes.length === 0) return null;

                const isToday = day === todaysClasses.name;

                return (
                  <View key={day} style={{ marginBottom: 16 }}>
                    <View style={styles.dayHeader}>
                      <Text style={[styles.dayTitle, isToday && { color: THEME.royalBlue }]}>
                        {day} {isToday && '(Today)'}
                      </Text>
                      <View style={styles.dayBadge}>
                        <Text style={styles.dayBadgeText}>{classes.length} Classes</Text>
                      </View>
                    </View>

                    <View style={styles.dayCard}>
                      {classes.map((c, idx) => (
                        <View key={c.id} style={[styles.classItem, idx > 0 && styles.classItemBorder]}>
                          <View style={styles.classTimeCol}>
                            <Text style={styles.classTime}>{formatTime(c.start_time)}</Text>
                            <Text style={styles.classTimeEnd}>{formatTime(c.end_time)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.classSubject}>{c.subject}</Text>
                            <Text style={styles.classMeta}>
                              <Ionicons name="location-outline" size={12} /> {c.room}
                              {c.teacher ? ` • ` : ''}
                              {c.teacher ? <><Ionicons name="person-outline" size={12} /> {c.teacher}</> : null}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })
            )}
          </>
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
    shadowColor: THEME.darkShadow, shadowOffset: { width: -4, height: -4 },
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
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },
  title: { fontSize: 18, fontWeight: '700', color: THEME.black },

  sectionCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  sectionIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: THEME.royalBlue + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionName: { fontSize: 16, fontWeight: '800', color: THEME.black },
  sectionSub: { fontSize: 12, color: THEME.gray, marginTop: 2 },
  sectionMetaRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: THEME.offWhiteDark,
  },
  sectionMeta: { fontSize: 12, color: THEME.darkGray },

  // Document Fallback Card
  docCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 20, marginBottom: 20,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 2,
  },
  docHeader: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  docIcon: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  docTitle: { fontSize: 15, fontWeight: '800', color: THEME.black, marginBottom: 4 },
  docSub: { fontSize: 12, color: THEME.gray, lineHeight: 18 },
  docFileBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.offWhite, padding: 12, borderRadius: 10, marginBottom: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  docFileName: { fontSize: 13, fontWeight: '600', color: THEME.royalBlue, flex: 1 },
  viewDocBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: THEME.royalBlue, padding: 14, borderRadius: 12,
  },
  viewDocBtnText: { fontSize: 14, fontWeight: '700', color: THEME.white },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: THEME.white, paddingVertical: 14, paddingHorizontal: 10,
    borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: THEME.royalBlue },
  statLbl: { fontSize: 9, fontWeight: '700', color: THEME.gray, marginTop: 4, textAlign: 'center' },

  todayCard: {
    backgroundColor: THEME.royalBlue, borderRadius: 16, padding: 16, marginBottom: 20,
    shadowColor: THEME.royalBlueDark, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  todayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  todayTitle: { fontSize: 14, fontWeight: '800', color: THEME.white },
  emptyToday: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' },
  todayClassItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
  },
  todayTime: {
    backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  todayTimeText: { fontSize: 11, fontWeight: '700', color: THEME.yellow },
  todaySubject: { fontSize: 14, fontWeight: '700', color: THEME.white, marginBottom: 2 },
  todayMeta: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  sectionTitle: {
    fontSize: 12, fontWeight: '800', color: THEME.gray, letterSpacing: 1,
    marginBottom: 12, marginTop: 4,
  },

  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  dayTitle: { fontSize: 15, fontWeight: '700', color: THEME.black },
  dayBadge: {
    backgroundColor: THEME.royalBlue + '15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  dayBadgeText: { fontSize: 11, fontWeight: '700', color: THEME.royalBlue },

  dayCard: {
    backgroundColor: THEME.offWhite, borderRadius: 16,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.4, shadowRadius: 10, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
    overflow: 'hidden',
  },
  classItem: {
    flexDirection: 'row', padding: 14, gap: 14,
  },
  classItemBorder: { borderTopWidth: 1, borderTopColor: THEME.offWhiteDark },
  classTimeCol: {
    width: 75, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 2, borderRightColor: THEME.offWhiteDark, paddingRight: 10,
  },
  classTime: { fontSize: 12, fontWeight: '800', color: THEME.royalBlue },
  classTimeEnd: { fontSize: 10, color: THEME.gray, marginTop: 2 },
  classSubject: { fontSize: 14, fontWeight: '700', color: THEME.black, marginBottom: 4 },
  classMeta: { fontSize: 11, color: THEME.gray },

  emptyContainer: {
    alignItems: 'center', padding: 40,
    backgroundColor: THEME.white, borderRadius: 16, marginBottom: 20,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  emptyText: { fontSize: 16, fontWeight: '700', color: THEME.black, marginTop: 12 },
  emptySub: { fontSize: 13, color: THEME.gray, textAlign: 'center', marginTop: 4 },

  summaryCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  summaryTitle: {
    fontSize: 14, fontWeight: '700', color: THEME.black, marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  chip: {
    backgroundColor: THEME.royalBlue + '10', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: THEME.royalBlue + '30',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: THEME.royalBlue },
});