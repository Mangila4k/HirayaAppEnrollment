import StudentSidebar from '@/components/StudentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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

const READ_ANNOUNCEMENTS_KEY = 'readAnnouncementIds';

type StudentInfo = {
  id: string;
  lrn: string;
  first_name: string;
  last_name: string;
  full_name: string;
  grade_level: string;
  strand: string;
  section_id: string;
  section_name: string;
  enrollment_status: string;
  student_type: string;
};

type Stats = {
  averageGrade: number | null;
  subjectsCount: number;
  attendanceRate: number;
  daysPresent: number;
  totalDays: number;
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url?: string | null;
  target_audience?: string | null;
  grade_level?: string | null;
  strand?: string | null;
};

export default function StudentDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [stats, setStats] = useState<Stats>({
    averageGrade: null,
    subjectsCount: 0,
    attendanceRate: 0,
    daysPresent: 0,
    totalDays: 0,
  });

  // UI State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);

  // Notifications
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Overview (single announcement)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) throw new Error('No user email found');

      // 1. Fetch Student
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

      // 2. SECTION from sections table
      const sectionId =
        studentData.section_id ||
        studentData.sectionId  ||
        studentData.section    ||
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
      } else if (studentData.section_name) {
        secName = studentData.section_name;
      }

      const fullName = `${studentData.first_name || ''} ${studentData.last_name || ''}`.trim() || 'Student';
      const sType = studentData.student_type || 'New Student';

      setStudent({
        id: studentData.id,
        lrn: studentData.lrn || 'N/A',
        first_name: studentData.first_name || '',
        last_name: studentData.last_name || '',
        full_name: fullName,
        grade_level: studentData.grade_level || 'Grade 11',
        strand: studentData.strand || 'N/A',
        section_id: sectionId || '',
        section_name: secName,
        enrollment_status: studentData.documents_status === 'complete' ? 'Enrolled' : 'Pending',
        student_type: sType,
      });

      // 3. Subjects count
      let subjectsCount = 0;
      if (sectionId) {
        const { data: schedData } = await supabase
          .from('schedules')
          .select('subject_id')
          .eq('section_id', sectionId);

        if (schedData) {
          const uniqueSubjs = new Set(schedData.map(s => s.subject_id).filter(Boolean));
          subjectsCount = uniqueSubjs.size;
        }
      }

      // 4. Average Grade
      const { data: gradesData } = await supabase.from('grades').select('grade').eq('student_id', studentData.id);
      let avgGrade = null;
      if (gradesData && gradesData.length > 0) {
        const sum = gradesData.reduce((acc: number, g: any) => acc + (g.grade || 0), 0);
        avgGrade = Math.round((sum / gradesData.length) * 100) / 100;
      }

      // 5. Attendance
      const { data: attData } = await supabase
        .from('attendance').select('*')
        .eq('student_id', studentData.id)
        .order('date', { ascending: false })
        .limit(5);

      let presentCount = 0;
      let totalDays = 0;

      const { data: allAttData } = await supabase.from('attendance').select('status').eq('student_id', studentData.id);
      if (allAttData) {
        totalDays = allAttData.length;
        allAttData.forEach((a: any) => {
          const s = (a.status || '').toLowerCase();
          if (s === 'present' || s === 'late' || s === 'excused') presentCount++;
        });
      }

      const rate = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 100;

      setStats({
        averageGrade: avgGrade,
        subjectsCount,
        attendanceRate: rate,
        daysPresent: presentCount,
        totalDays: totalDays,
      });

      if (attData) setRecentAttendance(attData);

      // 6. Announcements (with role filtering)
      await loadAnnouncements(studentData);

    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ===== Role-based audience matching =====
  const isAnnouncementForStudent = (a: any, s: any): boolean => {
    // No audience field → treat as for everyone
    if (!a.target_audience) return true;

    const audience = String(a.target_audience).toLowerCase().trim();

    // Global / students only
    if (['all', 'everyone', 'students', 'student'].includes(audience)) return true;

    // Grade-level target
    if (audience === 'grade' || audience === 'grade_level') {
      if (!a.grade_level) return true;
      return (
        String(a.grade_level).toLowerCase().replace(/\s+/g, '') ===
        String(s.grade_level || '').toLowerCase().replace(/\s+/g, '')
      );
    }

    // Strand target
    if (audience === 'strand') {
      if (!a.strand) return true;
      return (
        String(a.strand).toLowerCase() ===
        String(s.strand || '').toLowerCase()
      );
    }

    // Custom string could be e.g. "Grade 11 - STEM"
    if (a.grade_level && a.strand) {
      const gradeOk =
        String(a.grade_level).toLowerCase() === String(s.grade_level || '').toLowerCase();
      const strandOk =
        String(a.strand).toLowerCase() === String(s.strand || '').toLowerCase();
      return gradeOk && strandOk;
    }

    // Audience string directly equals student's role/grade
    return audience === String(s.grade_level || '').toLowerCase();
  };

  const loadAnnouncements = async (studentData: any) => {
    setNotifLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.warn('Announcements fetch error:', error.message);
        setAnnouncements([]);
      } else if (data) {
        // Filter by student role/grade/strand
        const filtered = data.filter((a: any) => isAnnouncementForStudent(a, studentData));
        setAnnouncements(filtered);
      }

      const raw = await AsyncStorage.getItem(READ_ANNOUNCEMENTS_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setReadIds(parsed);
        } catch {}
      }
    } catch (e) {
      console.warn('loadAnnouncements failed', e);
      setAnnouncements([]);
    } finally {
      setNotifLoading(false);
    }
  };

  const openNotifications = async () => {
    setNotifModalVisible(true);
    const ids = announcements.map(a => a.id);
    const merged = Array.from(new Set([...readIds, ...ids]));
    setReadIds(merged);
    try {
      await AsyncStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(merged));
    } catch {}
  };

  // ===== Open overview of a single announcement =====
  const openAnnouncementDetail = (announcement: Announcement) => {
    // Mark this specific one as read too (in case user opens from list before modal close)
    if (!readIds.includes(announcement.id)) {
      const merged = [...readIds, announcement.id];
      setReadIds(merged);
      AsyncStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify(merged)).catch(() => {});
    }
    setSelectedAnnouncement(announcement);
    setNotifModalVisible(false);   // close the list, then show details
    setDetailModalVisible(true);
  };

  const closeAnnouncementDetail = () => {
    setDetailModalVisible(false);
    setSelectedAnnouncement(null);
    setNotifModalVisible(true);    // return to the list
  };

  const unreadCount = announcements.filter(a => !readIds.includes(a.id)).length;

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      });
    } catch { return dateStr; }
  };

  const getAudienceLabel = (a: Announcement): string => {
    if (!a.target_audience) return 'Everyone';
    const t = String(a.target_audience).toLowerCase();
    if (t === 'all' || t === 'everyone') return 'Everyone';
    if (t === 'students' || t === 'student') return 'All Students';
    if (t === 'grade' || t === 'grade_level') return a.grade_level ? String(a.grade_level) : 'Grade';
    if (t === 'strand') return a.strand ? String(a.strand) : 'Strand';
    return String(a.target_audience);
  };

  const getStudentTypeInfo = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('transfer')) {
      return { icon: 'swap-horizontal', color: THEME.warning, desc: 'Transferred from another school' };
    }
    if (t.includes('old') || t.includes('continuing')) {
      return { icon: 'refresh', color: THEME.success, desc: 'Continuing student - progressing to next grade' };
    }
    return { icon: 'star', color: THEME.royalBlue, desc: 'First time enrollee' };
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

  const sTypeInfo = getStudentTypeInfo(student?.student_type || 'New Student');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.royalBlue} />}
      >
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setDrawerOpen(true)}>
            <Ionicons name="menu-outline" size={22} color={THEME.royalBlue} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.nameGreeting} numberOfLines={1}>{student?.full_name}</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={openNotifications}>
              <Ionicons name="notifications-outline" size={20} color={THEME.royalBlue} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== STUDENT TYPE CARD ===== */}
        <View style={styles.typeCard}>
          <View style={[styles.typeIconWrap, { backgroundColor: sTypeInfo.color + '20' }]}>
            <Ionicons name={sTypeInfo.icon as any} size={24} color={sTypeInfo.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.typeTitle}>{student?.student_type}</Text>
            <Text style={styles.typeDesc}>{sTypeInfo.desc}</Text>
          </View>
        </View>

        {/* ===== STATS GRID ===== */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>STATUS</Text>
              <Ionicons name="school" size={16} color={THEME.royalBlue} />
            </View>
            <Text style={styles.statNum}>{student?.grade_level}</Text>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: student?.enrollment_status === 'Enrolled' ? THEME.success : THEME.warning }]} />
              <Text style={styles.statusText}>{student?.enrollment_status}</Text>
            </View>
            <Text style={styles.statSub}>Section: {student?.section_name}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>SUBJECTS</Text>
              <Ionicons name="book" size={16} color={THEME.royalBlue} />
            </View>
            <Text style={styles.statNum}>{stats.subjectsCount}</Text>
            <Text style={styles.statSub}>Current Subjects</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>AVERAGE</Text>
              <Ionicons name="star" size={16} color={THEME.yellow} />
            </View>
            <Text style={styles.statNum}>{stats.averageGrade ? `${stats.averageGrade}%` : '--'}</Text>
            <Text style={styles.statSub}>Overall Average</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>ATTENDANCE</Text>
              <Ionicons name="calendar" size={16} color={THEME.success} />
            </View>
            <Text style={styles.statNum}>{stats.attendanceRate}%</Text>
            <Text style={styles.statSub}>{stats.daysPresent}/{stats.totalDays} Days</Text>
          </View>
        </View>

        {/* ===== RECENT ATTENDANCE ===== */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Attendance</Text>
          <TouchableOpacity onPress={() => router.push('/student/attendance' as any)}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentCard}>
          {recentAttendance.length === 0 ? (
            <Text style={styles.emptyText}>No recent attendance records.</Text>
          ) : (
            recentAttendance.map((att, i) => {
              const isPresent = (att.status || '').toLowerCase() === 'present';
              const isLate = (att.status || '').toLowerCase() === 'late';
              const color = isPresent ? THEME.success : (isLate ? THEME.warning : THEME.danger);

              return (
                <View key={att.id || i} style={[styles.attItem, i > 0 && styles.attItemBorder]}>
                  <View style={[styles.attDot, { backgroundColor: color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attDate}>Daily Attendance - {formatDate(att.date)}</Text>
                    <Text style={styles.attMeta}>
                      In: {att.time_in || '—'} | Out: {att.time_out || '—'} • {att.remarks || 'On time'}
                    </Text>
                  </View>
                  <View style={[styles.attBadge, { backgroundColor: color + '20' }]}>
                    <Text style={[styles.attBadgeText, { color }]}>{att.status || 'Present'}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ===== SCHOOL INFO FOOTER ===== */}
        <View style={styles.footerInfo}>
          <Text style={styles.footerTitle}>PLACIDO L. SEÑOR NATIONAL HIGH SCHOOL</Text>
          <Text style={styles.footerText}>Langtad, City of Naga, Cebu 6037</Text>
          <Text style={styles.footerText}>(032) 123-4567 · info@plsnhs.edu.ph</Text>
        </View>

      </ScrollView>

      {/* ===== NOTIFICATIONS LIST MODAL ===== */}
      <Modal visible={notifModalVisible} transparent animationType="slide" onRequestClose={() => setNotifModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.modalTitle}>Notifications</Text>
                {announcements.length > 0 && (
                  <View style={styles.modalCountPill}>
                    <Text style={styles.modalCountText}>{announcements.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                <Ionicons name="close" size={24} color={THEME.black} />
              </TouchableOpacity>
            </View>

            {notifLoading ? (
              <View style={styles.notifEmpty}>
                <ActivityIndicator size="small" color={THEME.royalBlue} />
                <Text style={[styles.emptyText, { marginTop: 10 }]}>Loading announcements…</Text>
              </View>
            ) : (
              <ScrollView style={{ padding: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {announcements.length === 0 ? (
                  <View style={styles.notifEmpty}>
                    <Ionicons name="notifications-off-outline" size={40} color={THEME.gray} />
                    <Text style={[styles.emptyText, { marginTop: 12 }]}>
                      No announcements right now.
                    </Text>
                    <Text style={styles.notifEmptySub}>
                      School-wide updates will appear here when posted.
                    </Text>
                  </View>
                ) : (
                  announcements.map((a) => {
                    const isUnread = !readIds.includes(a.id);
                    return (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.notifItem, isUnread && styles.notifItemUnread]}
                        onPress={() => openAnnouncementDetail(a)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.notifIconWrap}>
                          <Ionicons
                            name="megaphone-outline"
                            size={18}
                            color={isUnread ? THEME.royalBlue : THEME.gray}
                          />
                          {isUnread && <View style={styles.notifDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.notifTitle} numberOfLines={2}>{a.title}</Text>
                          {a.content ? (
                            <Text style={styles.notifBody} numberOfLines={3}>{a.content}</Text>
                          ) : null}
                          <View style={styles.notifMetaRow}>
                            <View style={styles.notifAudiencePill}>
                              <Ionicons name="people-outline" size={10} color={THEME.royalBlue} />
                              <Text style={styles.notifAudienceText}>{getAudienceLabel(a)}</Text>
                            </View>
                            <Text style={styles.notifTime}>{formatDateTime(a.created_at)}</Text>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={THEME.gray} style={{ alignSelf: 'center' }} />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ===== ANNOUNCEMENT DETAIL (OVERVIEW) MODAL ===== */}
      <Modal visible={detailModalVisible} transparent animationType="slide" onRequestClose={closeAnnouncementDetail}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="megaphone" size={18} color={THEME.royalBlue} />
                <Text style={styles.modalTitle}>Announcement</Text>
              </View>
              <TouchableOpacity onPress={closeAnnouncementDetail}>
                <Ionicons name="close" size={24} color={THEME.black} />
              </TouchableOpacity>
            </View>

            {selectedAnnouncement && (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
                {/* Image (if any) */}
                {selectedAnnouncement.image_url ? (
                  <Image
                    source={{ uri: selectedAnnouncement.image_url }}
                    style={styles.detailImage}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Audience + Date */}
                <View style={styles.detailMetaRow}>
                  <View style={styles.notifAudiencePill}>
                    <Ionicons name="people-outline" size={11} color={THEME.royalBlue} />
                    <Text style={styles.notifAudienceText}>
                      {getAudienceLabel(selectedAnnouncement)}
                    </Text>
                  </View>
                  <Text style={styles.detailDate}>
                    {formatDateTime(selectedAnnouncement.created_at)}
                  </Text>
                </View>

                {/* Title */}
                <Text style={styles.detailTitle}>{selectedAnnouncement.title}</Text>

                {/* Content */}
                <Text style={styles.detailBody}>
                  {selectedAnnouncement.content || 'No further details provided.'}
                </Text>

                {/* Close button */}
                <TouchableOpacity style={styles.detailCloseBtn} onPress={closeAnnouncementDetail}>
                  <Text style={styles.detailCloseBtnText}>Back to Notifications</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
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

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
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
  headerCenter: { flex: 1, paddingHorizontal: 16 },
  greeting: { fontSize: 12, color: THEME.gray, fontWeight: '500' },
  nameGreeting: { fontSize: 18, fontWeight: '800', color: THEME.black, marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  notifBadge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: THEME.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  notifBadgeText: {
    color: THEME.white, fontSize: 9, fontWeight: '800',
  },

  // Student Type Card
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: THEME.white, padding: 16, borderRadius: 16, marginBottom: 20,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  typeIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  typeTitle: { fontSize: 15, fontWeight: '700', color: THEME.black },
  typeDesc: { fontSize: 12, color: THEME.gray, marginTop: 2 },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24,
  },
  statCard: {
    width: '47%', backgroundColor: THEME.white, padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statLabel: { fontSize: 10, fontWeight: '700', color: THEME.gray, letterSpacing: 0.5 },
  statNum: { fontSize: 22, fontWeight: '800', color: THEME.royalBlue, marginBottom: 4 },
  statSub: { fontSize: 11, color: THEME.gray, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600', color: THEME.darkGray },

  // Section Title
  sectionTitle: { fontSize: 16, fontWeight: '800', color: THEME.black, marginBottom: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAllText: { fontSize: 12, fontWeight: '700', color: THEME.royalBlue },

  // Recent Attendance
  recentCard: {
    backgroundColor: THEME.white, borderRadius: 16, padding: 16, marginBottom: 24,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  attItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  attItemBorder: { borderTopWidth: 1, borderTopColor: THEME.offWhiteDark },
  attDot: { width: 10, height: 10, borderRadius: 5 },
  attDate: { fontSize: 13, fontWeight: '600', color: THEME.black },
  attMeta: { fontSize: 11, color: THEME.gray, marginTop: 2 },
  attBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  attBadgeText: { fontSize: 10, fontWeight: '700' },
  emptyText: { fontSize: 13, color: THEME.gray, textAlign: 'center', fontStyle: 'italic' },

  // Footer Info
  footerInfo: {
    backgroundColor: THEME.royalBlue, borderRadius: 16, padding: 20, alignItems: 'center',
  },
  footerTitle: { fontSize: 12, fontWeight: '800', color: THEME.white, marginBottom: 4 },
  footerText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  // Modal (shared)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,32,44,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: THEME.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '80%', minHeight: '40%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: THEME.offWhiteDark,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: THEME.black },
  modalCountPill: {
    backgroundColor: THEME.royalBlue, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  modalCountText: { fontSize: 11, fontWeight: '800', color: THEME.white },

  // Notifications list
  notifEmpty: { alignItems: 'center', paddingVertical: 32 },
  notifEmptySub: { fontSize: 12, color: THEME.gray, textAlign: 'center', marginTop: 4, paddingHorizontal: 12 },
  notifItem: {
    flexDirection: 'row', gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: THEME.offWhiteDark,
  },
  notifItemUnread: {
    backgroundColor: THEME.royalBlue + '08',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginHorizontal: -4,
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  notifIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: THEME.royalBlue + '15',
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute', top: 4, right: 4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: THEME.danger,
  },
  notifTitle: { fontSize: 14, fontWeight: '700', color: THEME.black, marginBottom: 2 },
  notifBody: { fontSize: 12, color: THEME.darkGray, lineHeight: 18 },
  notifMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  notifAudiencePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: THEME.royalBlue + '12',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  notifAudienceText: { fontSize: 9, fontWeight: '700', color: THEME.royalBlue, textTransform: 'uppercase' },
  notifTime: { fontSize: 10, color: THEME.gray, fontWeight: '600' },

  // Announcement detail (overview) modal
  detailCard: {
    backgroundColor: THEME.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '88%', minHeight: '50%',
  },
  detailImage: {
    width: '100%', height: 200, borderRadius: 14, marginBottom: 16,
    backgroundColor: THEME.offWhiteDark,
  },
  detailMetaRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailDate: { fontSize: 11, color: THEME.gray, fontWeight: '600' },
  detailTitle: {
    fontSize: 20, fontWeight: '800', color: THEME.black,
    marginBottom: 12, lineHeight: 26,
  },
  detailBody: {
    fontSize: 14, color: THEME.darkGray, lineHeight: 22, marginBottom: 24,
  },
  detailCloseBtn: {
    backgroundColor: THEME.royalBlue, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  detailCloseBtnText: { color: THEME.white, fontSize: 14, fontWeight: '700' },
});