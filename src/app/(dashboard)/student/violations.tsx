import StudentSidebar from '@/components/StudentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

// ===== TYPES =====
type Violation = {
  id: string;
  violation_title: string;
  violation_category?: string;
  description?: string;
  incident_date: string;
  incident_time?: string;
  incident_location?: string;
  reported_by?: string;
  offense_level?: string;
  status?: string;
  action_taken?: string;
  sanction_details?: string;
  counselor_notes?: string;
  parent_notified?: boolean;
};

type FilterTab = 'all' | 'pending' | 'counseling' | 'resolved';

// ===== SCREEN =====
export default function StudentViolations() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [studentData, setStudentData] = useState<any>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [currentFilter, setCurrentFilter] = useState<FilterTab>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [currentCase, setCurrentCase] = useState<Violation | null>(null);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        router.replace('/(auth)/login');
        return;
      }

      let student: any = null;
      const { data: userData } = await supabase
        .from('users')
        .select('student_id')
        .eq('email', email)
        .maybeSingle();

      if (userData?.student_id) {
        const { data } = await supabase.from('students').select('*').eq('id', userData.student_id).maybeSingle();
        student = data;
      }
      if (!student) {
        const { data } = await supabase.from('students').select('*').eq('email', email).maybeSingle();
        student = data;
      }

      if (!student) throw new Error('Student record not found.');
      setStudentData(student);

      let query = supabase.from('student_violations').select('*');

      if (student.id && student.lrn) {
        query = query.or(`student_id.eq.${student.id},lrn.eq.${student.lrn}`);
      } else if (student.id) {
        query = query.eq('student_id', student.id);
      } else if (student.lrn) {
        query = query.eq('lrn', student.lrn);
      } else {
        const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
        query = query.ilike('student_name', `%${fullName}%`);
      }

      const { data: vData, error: vErr } = await query.order('incident_date', { ascending: false });

      if (vErr) {
        console.warn('Violations query error:', vErr);
        setViolations([]);
      } else {
        setViolations(vData || []);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message || 'Unable to load disciplinary records.');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = violations.length;
    const pending = violations.filter(v => {
      const st = (v.status || '').toLowerCase();
      return st === 'pending' || st === 'reported' || st === 'under investigation';
    }).length;
    const counseling = violations.filter(v => (v.status || '').toLowerCase().includes('counseling')).length;
    const resolved = violations.filter(v => {
      const st = (v.status || '').toLowerCase();
      return st === 'resolved' || st === 'dismissed' || st === 'completed';
    }).length;

    return { total, pending, counseling, resolved };
  }, [violations]);

  const standing = useMemo(() => {
    if (stats.total === 0 || (stats.pending === 0 && stats.counseling === 0)) {
      return {
        type: 'good',
        icon: 'checkmark-circle',
        title: 'Good Moral Standing',
        desc: stats.total === 0
          ? 'You currently have a clean disciplinary record with no offenses on file.'
          : 'All previous recorded incidents have been resolved with completed guidance action plans.',
        badgeText: 'Good Standing',
        badgeIcon: 'ribbon',
        color: THEME.success,
        bg: '#DCFCE7',
      };
    }
    if (stats.counseling > 0) {
      return {
        type: 'warning',
        icon: 'person-circle',
        title: 'Guidance Counseling In Progress',
        desc: `You have ${stats.counseling} active counseling case(s) scheduled. Please coordinate with the Guidance Office.`,
        badgeText: 'Action Required',
        badgeIcon: 'alert-circle',
        color: THEME.warning,
        bg: '#FEF3C7',
      };
    }
    return {
      type: 'danger',
      icon: 'alert-circle',
      title: 'Disciplinary Case Under Review',
      desc: `You have ${stats.pending} incident report(s) under investigation. An official guidance decision is pending.`,
      badgeText: 'Case Pending',
      badgeIcon: 'time',
      color: THEME.danger,
      bg: '#FEE2E2',
    };
  }, [stats]);

  const filteredViolations = useMemo(() => {
    if (currentFilter === 'all') return violations;

    return violations.filter(v => {
      const st = (v.status || '').toLowerCase();
      if (currentFilter === 'pending') return st === 'pending' || st === 'reported' || st === 'under investigation';
      if (currentFilter === 'counseling') return st.includes('counseling');
      if (currentFilter === 'resolved') return st === 'resolved' || st === 'dismissed' || st === 'completed';
      return true;
    });
  }, [violations, currentFilter]);

  const formatDate = (iso?: string) => {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
  };

  const openCaseModal = (item: Violation) => {
    setCurrentCase(item);
    setModalVisible(true);
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setDrawerOpen(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.royalBlue} />
          </TouchableOpacity>
          <Text style={styles.title}>Guidance & Conduct</Text>
          <TouchableOpacity onPress={init} style={styles.iconBtn}>
            <Ionicons name="refresh" size={18} color={THEME.royalBlue} />
          </TouchableOpacity>
        </View>

        {/* Standing Banner */}
        <View style={[styles.standingCard, { backgroundColor: standing.bg }]}>
          <View style={styles.standingLeft}>
            <View style={[styles.standingIconWrap, { backgroundColor: standing.color }]}>
              <Ionicons name={standing.icon as any} size={26} color={THEME.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.standingTitle}>{standing.title}</Text>
              <Text style={styles.standingDesc}>{standing.desc}</Text>
            </View>
          </View>
          <View style={[styles.standingBadge, { backgroundColor: standing.color }]}>
            <Ionicons name={standing.badgeIcon as any} size={12} color={THEME.white} />
            <Text style={styles.standingBadgeText}>{standing.badgeText}</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: THEME.royalBlue + '15' }]}>
              <Ionicons name="scale" size={20} color={THEME.royalBlue} />
            </View>
            <View>
              <Text style={styles.statNum}>{stats.total}</Text>
              <Text style={styles.statLbl}>TOTAL INCIDENTS</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={20} color={THEME.warning} />
            </View>
            <View>
              <Text style={styles.statNum}>{stats.pending}</Text>
              <Text style={styles.statLbl}>PENDING</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="chatbubbles" size={20} color={THEME.info} />
            </View>
            <View>
              <Text style={styles.statNum}>{stats.counseling}</Text>
              <Text style={styles.statLbl}>COUNSELING</Text>
            </View>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={20} color={THEME.success} />
            </View>
            <View>
              <Text style={styles.statNum}>{stats.resolved}</Text>
              <Text style={styles.statLbl}>RESOLVED</Text>
            </View>
          </View>
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          {[
            { key: 'all', label: 'All Records' },
            { key: 'pending', label: 'Pending' },
            { key: 'counseling', label: 'Counseling' },
            { key: 'resolved', label: 'Resolved' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterChip, currentFilter === tab.key && styles.filterChipActive]}
              onPress={() => setCurrentFilter(tab.key as FilterTab)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterChipText, currentFilter === tab.key && styles.filterChipTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Violations List */}
        {filteredViolations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark" size={48} color={THEME.success} />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySub}>
              {currentFilter === 'all'
                ? 'You have no disciplinary violations or incident reports on record. Keep up the exemplary conduct!'
                : 'No records match the selected filter category.'}
            </Text>
          </View>
        ) : (
          filteredViolations.map((v, index) => {
            const rawStatus = (v.status || 'Pending').toLowerCase();
            let statusColor = THEME.gray;
            let statusBg = THEME.offWhiteDark;
            let statusIcon: any = 'time';
            if (rawStatus === 'resolved' || rawStatus === 'dismissed' || rawStatus === 'completed') {
              statusColor = THEME.success; statusBg = '#DCFCE7'; statusIcon = 'checkmark-circle';
            } else if (rawStatus.includes('counseling')) {
              statusColor = '#8B5CF6'; statusBg = '#F3E8FF'; statusIcon = 'chatbubbles';
            } else if (rawStatus.includes('progress') || rawStatus.includes('investigation')) {
              statusColor = THEME.warning; statusBg = '#FEF3C7'; statusIcon = 'hourglass';
            }

            const offenseRaw = (v.offense_level || '1st Offense').toLowerCase();
            let offenseColor = THEME.royalBlue; let offenseBg = '#E0F2FE';
            if (offenseRaw.includes('2nd')) { offenseColor = THEME.warning; offenseBg = '#FEF3C7'; }
            else if (offenseRaw.includes('3rd') || offenseRaw.includes('habitual')) { offenseColor = THEME.danger; offenseBg = '#FEE2E2'; }

            let stripeColor = THEME.info;
            if (offenseRaw.includes('2nd')) stripeColor = THEME.warning;
            else if (offenseRaw.includes('3rd')) stripeColor = THEME.danger;
            else if (rawStatus === 'resolved') stripeColor = THEME.success;

            return (
              <TouchableOpacity
                key={v.id || index}
                style={styles.violationCard}
                onPress={() => openCaseModal(v)}
                activeOpacity={0.9}
              >
                <View style={[styles.vStripe, { backgroundColor: stripeColor }]} />

                <View style={styles.vHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vTitle}>{v.violation_title || 'Disciplinary Violation'}</Text>
                    <View style={styles.vMetaRow}>
                      <Text style={styles.vMeta}><Ionicons name="calendar" size={11} /> {formatDate(v.incident_date)}</Text>
                      <Text style={styles.vMeta}><Ionicons name="location" size={11} /> {v.incident_location || 'Campus'}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={[styles.badge, { backgroundColor: offenseBg }]}>
                      <Text style={[styles.badgeText, { color: offenseColor }]}>{v.offense_level || '1st Offense'}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: statusBg }]}>
                      <Ionicons name={statusIcon} size={10} color={statusColor} />
                      <Text style={[styles.badgeText, { color: statusColor }]}>{v.status || 'Pending'}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.vDescription} numberOfLines={2}>
                  <Text style={{ fontWeight: '700' }}>Incident Summary: </Text>
                  {v.description || 'No detailed statement recorded.'}
                </Text>

                <View style={styles.vFooter}>
                  <View style={styles.parentNotif}>
                    <Ionicons
                      name={v.parent_notified ? 'checkmark-circle' : 'notifications'}
                      size={14}
                      color={v.parent_notified ? THEME.success : THEME.gray}
                    />
                    <Text style={styles.parentNotifText}>
                      {v.parent_notified ? 'Parent notified' : 'Parent notice pending'}
                    </Text>
                  </View>
                  <View style={styles.viewBtn}>
                    <Text style={styles.viewBtnText}>View Details</Text>
                    <Ionicons name="chevron-forward" size={14} color={THEME.white} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

      </ScrollView>

      {/* ===== CASE DETAILS MODAL ===== */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="document-text" size={20} color={THEME.yellow} />
                <Text style={styles.modalTitle}>Case Details</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={THEME.white} />
              </TouchableOpacity>
            </View>

            {currentCase && (
              <ScrollView style={{ padding: 20 }}>
                <View style={styles.modalCaseHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>CASE FILE</Text>
                    <Text style={styles.modalCaseTitle}>{currentCase.violation_title}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 4 }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.royalBlue }}>
                      {currentCase.offense_level || '1st Offense'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalMetaGrid}>
                  <View style={styles.modalMetaItem}>
                    <Text style={styles.modalMetaLabel}>INCIDENT DATE</Text>
                    <Text style={styles.modalMetaValue}>{formatDate(currentCase.incident_date)} {currentCase.incident_time ? `(${currentCase.incident_time})` : ''}</Text>
                  </View>
                  <View style={styles.modalMetaItem}>
                    <Text style={styles.modalMetaLabel}>LOCATION</Text>
                    <Text style={styles.modalMetaValue}>{currentCase.incident_location || 'Campus'}</Text>
                  </View>
                  <View style={styles.modalMetaItem}>
                    <Text style={styles.modalMetaLabel}>REPORTED BY</Text>
                    <Text style={styles.modalMetaValue}>{currentCase.reported_by || 'Faculty/Staff'}</Text>
                  </View>
                  <View style={styles.modalMetaItem}>
                    <Text style={styles.modalMetaLabel}>STATUS</Text>
                    <Text style={styles.modalMetaValue}>{currentCase.status || 'Pending'}</Text>
                  </View>
                </View>

                <Text style={[styles.modalSectionTitle, { marginTop: 20 }]}>INCIDENT DESCRIPTION</Text>
                <Text style={styles.modalBodyText}>{currentCase.description || 'No statement recorded.'}</Text>

                <View style={styles.decisionBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="scale" size={16} color="#3730A3" />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#3730A3', textTransform: 'uppercase' }}>Guidance Decision</Text>
                  </View>
                  <Text style={styles.decisionAction}>{currentCase.action_taken || 'Under Administrative Consideration'}</Text>
                  <Text style={styles.sanctionText}>
                    <Text style={{ fontWeight: '700' }}>Sanction / Task: </Text>
                    {currentCase.sanction_details || 'Standard warning and record filing'}
                  </Text>
                </View>

                {currentCase.counselor_notes && (
                  <>
                    <Text style={styles.modalSectionTitle}>COUNSELOR NOTES</Text>
                    <Text style={styles.modalBodyText}>{currentCase.counselor_notes}</Text>
                  </>
                )}

                <View style={styles.modalFooterRow}>
                  <Text style={styles.modalFooterText}>
                    <Text style={{ fontWeight: '700' }}>Parent Notified: </Text>
                    <Text style={{ color: currentCase.parent_notified ? THEME.success : THEME.warning }}>
                      {currentCase.parent_notified ? 'Yes (Dispatched)' : 'Pending'}
                    </Text>
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnText}>Close</Text>
              </TouchableOpacity>
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
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: THEME.lightShadow, borderLeftColor: THEME.lightShadow,
  },
  title: { fontSize: 18, fontWeight: '700', color: THEME.black },

  standingCard: {
    flexDirection: 'column',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  standingLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  standingIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  standingTitle: { fontSize: 16, fontWeight: '800', color: THEME.black },
  standingDesc: { fontSize: 12, color: THEME.darkGray, marginTop: 2, lineHeight: 18 },
  standingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 20,
  },
  standingBadgeText: { fontSize: 11, fontWeight: '700', color: THEME.white, textTransform: 'uppercase' },

  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: THEME.offWhite,
    padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 3,
  },
  statIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  statNum: { fontSize: 20, fontWeight: '800', color: THEME.black, lineHeight: 22 },
  statLbl: { fontSize: 10, fontWeight: '700', color: THEME.gray, letterSpacing: 0.5 },

  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: THEME.white, borderWidth: 1, borderColor: THEME.offWhiteDark,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: THEME.royalBlue, borderColor: THEME.royalBlue },
  filterChipText: { fontSize: 12, fontWeight: '600', color: THEME.darkGray },
  filterChipTextActive: { color: THEME.white },

  violationCard: {
    backgroundColor: THEME.offWhite, borderRadius: 16,
    padding: 16, marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  vStripe: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
  },
  vHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 10,
  },
  vTitle: { fontSize: 15, fontWeight: '700', color: THEME.black, marginBottom: 4, paddingRight: 8 },
  vMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vMeta: { fontSize: 11, color: THEME.gray, flexDirection: 'row', alignItems: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  vDescription: { fontSize: 13, color: THEME.darkGray, lineHeight: 18, marginBottom: 12 },

  vFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: THEME.white,
    paddingTop: 10,
  },
  parentNotif: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  parentNotifText: { fontSize: 11, color: THEME.gray, fontWeight: '500' },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: THEME.royalBlue,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  viewBtnText: { fontSize: 11, color: THEME.white, fontWeight: '700' },

  emptyContainer: {
    alignItems: 'center', padding: 40,
    backgroundColor: THEME.offWhite, borderRadius: 20,
    marginTop: 10,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    shadowColor: THEME.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 5,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: THEME.black, marginTop: 12 },
  emptySub: { fontSize: 13, color: THEME.gray, textAlign: 'center', marginTop: 6 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(26,32,44,0.6)',
    justifyContent: 'center', padding: 16,
  },
  modalCard: {
    backgroundColor: THEME.offWhite,
    borderRadius: 20, maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: THEME.royalBlue, paddingHorizontal: 16, paddingVertical: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: THEME.white },
  modalClose: { padding: 4 },

  modalCaseHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: THEME.white, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
    marginBottom: 16,
  },
  modalLabel: { fontSize: 10, fontWeight: '700', color: THEME.gray, letterSpacing: 1, marginBottom: 2 },
  modalCaseTitle: { fontSize: 16, fontWeight: '800', color: THEME.royalBlue },

  modalMetaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
  },
  modalMetaItem: { width: '47%' },
  modalMetaLabel: { fontSize: 10, fontWeight: '700', color: THEME.gray, textTransform: 'uppercase', marginBottom: 2 },
  modalMetaValue: { fontSize: 13, fontWeight: '600', color: THEME.black },

  modalSectionTitle: {
    fontSize: 11, fontWeight: '800', color: THEME.gray,
    letterSpacing: 0.5, marginBottom: 6, marginTop: 12,
  },
  modalBodyText: {
    fontSize: 13, color: THEME.darkGray, lineHeight: 20,
    backgroundColor: THEME.white, padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },

  decisionBox: {
    backgroundColor: '#EEF2FF', borderLeftWidth: 4, borderLeftColor: '#4F46E5',
    padding: 14, borderRadius: 8, marginTop: 16, marginBottom: 16,
  },
  decisionAction: { fontSize: 15, fontWeight: '700', color: '#1E1B4B', marginBottom: 4 },
  sanctionText: { fontSize: 13, color: '#312E81' },

  modalFooterRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: THEME.white, padding: 12, borderRadius: 8,
    borderWidth: 1, borderColor: THEME.offWhiteDark,
  },
  modalFooterText: { fontSize: 12, color: THEME.darkGray },

  modalBtnRow: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
    padding: 16, borderTopWidth: 1, borderTopColor: THEME.offWhiteDark,
    backgroundColor: THEME.offWhite,
  },
  modalBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: THEME.gray, borderRadius: 8,
  },
  modalBtnText: { color: THEME.white, fontWeight: '700', fontSize: 13 },
});