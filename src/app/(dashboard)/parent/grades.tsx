import { useTheme } from '@/app/_context/themecontext';
import ParentSidebar from '@/components/ParentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Child = { id: string; full_name: string; grade_level: string; strand: string };
type SubjectGroup = {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  quarters: Record<number, number>;
  average: number;
  remarks: string;
};

const NEU = {
  bg: '#E8EDF2',
  bgDark: '#D1D9E6',
  lightShadow: '#FFFFFF',
  darkShadow: '#A3B1C6',
  text: '#2E3A4D',
  textMuted: '#7A8699',
  textFaint: '#A0ACBE',
};

export default function ParentGrades() {
  const { theme, primaryColor } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { loadChildren(); }, []);
  useEffect(() => { if (selectedChild) loadGrades(selectedChild); }, [selectedChild]);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) { setLoading(false); return; }

      const { data: userData } = await supabase
        .from('users').select('id').eq('email', email).maybeSingle();
      if (!userData) { setLoading(false); return; }

      const { data: kids } = await supabase
        .from('students')
        .select('id, first_name, last_name, grade_level, strand')
        .eq('parent_id', userData.id);

      if (kids && kids.length > 0) {
        const list = kids.map((k: any) => ({
          id: k.id,
          full_name: `${k.first_name || ''} ${k.last_name || ''}`.trim() || 'Unknown',
          grade_level: k.grade_level || 'N/A',
          strand: k.strand || 'N/A',
        }));
        setChildren(list);
        setSelectedChild(list[0]);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadGrades = async (child: Child) => {
    setLoading(true);
    try {
      const { data: gradesData } = await supabase
        .from('grades')
        .select('id, subject_id, quarter, grade, remarks')
        .eq('student_id', child.id);

      if (!gradesData || gradesData.length === 0) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const subjectIds = [...new Set(gradesData.map((g: any) => g.subject_id).filter(Boolean))];
      const subjectMap: Record<string, any> = {};
      if (subjectIds.length > 0) {
        const { data: subs } = await supabase
          .from('subjects').select('id, name, code').in('id', subjectIds);
        (subs || []).forEach((s: any) => { subjectMap[s.id] = s; });
      }

      const grouped: Record<string, SubjectGroup> = {};
      gradesData.forEach((g: any) => {
        const sid = g.subject_id || 'no_subject';
        const sub = subjectMap[sid];
        if (!grouped[sid]) {
          grouped[sid] = {
            subject_id: sid,
            subject_name: sub?.name || 'Unknown Subject',
            subject_code: sub?.code || '',
            quarters: {}, average: 0, remarks: '',
          };
        }
        grouped[sid].quarters[g.quarter] = g.grade;
      });

      const result = Object.values(grouped).map(g => {
        const values = Object.values(g.quarters);
        const avg = values.length > 0
          ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100
          : 0;
        return { ...g, average: avg, remarks: avg >= 75 ? 'Passed' : 'Failed' };
      });

      result.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
      setGroups(result);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const gradeColor = (g: number) => {
    if (g >= 90) return '#4CAF50';
    if (g >= 85) return '#8BC34A';
    if (g >= 75) return '#FF9800';
    return '#F44336';
  };

  if (loading && children.length === 0) {
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
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            style={styles.iconBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="menu-outline" size={22} color={NEU.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Grades</Text>
          <View style={{ width: 44 }} />
        </View>

        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.childPicker}>
            {children.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.childChip,
                  selectedChild?.id === c.id && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
                  },
                ]}
                onPress={() => setSelectedChild(c)}
              >
                <Text
                  style={[
                    styles.childChipText,
                    selectedChild?.id === c.id && { color: '#fff', fontWeight: '700' },
                  ]}
                >
                  {c.full_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedChild && (
          <View style={styles.childInfoCard}>
            <View style={[styles.avatar, { backgroundColor: primaryColor + '15' }]}>
              <Text style={[styles.avatarText, { color: primaryColor }]}>
                {selectedChild.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.childName}>{selectedChild.full_name}</Text>
              <Text style={styles.childMeta}>
                Grade {selectedChild.grade_level}
                {selectedChild.strand !== 'N/A' ? ` • ${selectedChild.strand}` : ''}
              </Text>
            </View>
          </View>
        )}

        {groups.length > 0 ? (
          groups.map(g => {
            const isOpen = expanded === g.subject_id;
            const c = gradeColor(g.average);
            return (
              <View key={g.subject_id} style={styles.subjectCard}>
                <TouchableOpacity
                  style={styles.subjectHeader}
                  onPress={() => setExpanded(isOpen ? null : g.subject_id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subjectName}>{g.subject_name}</Text>
                    <Text style={styles.subjectCode}>{g.subject_code}</Text>
                  </View>
                  <View style={[styles.avgBadge, { backgroundColor: c + '20' }]}>
                    <Text style={[styles.avgText, { color: c }]}>{g.average}</Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-down' : 'chevron-forward'}
                    size={20}
                    color={NEU.textMuted}
                  />
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.quartersContainer}>
                    {[1, 2, 3, 4].map(q => {
                      const val = g.quarters[q];
                      return (
                        <View key={q} style={styles.quarterRow}>
                          <Text style={styles.quarterLabel}>Quarter {q}</Text>
                          <Text style={[styles.quarterValue, { color: val ? gradeColor(val) : NEU.textMuted }]}>
                            {val ?? '—'}
                          </Text>
                        </View>
                      );
                    })}
                    <View style={styles.remarksRow}>
                      <Text style={styles.remarksLabel}>Remarks</Text>
                      <Text style={[styles.remarksValue, { color: g.remarks === 'Passed' ? '#4CAF50' : '#F44336' }]}>
                        {g.remarks}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={50} color={NEU.textMuted} />
            <Text style={styles.emptyText}>No grades available yet</Text>
          </View>
        )}
      </ScrollView>

      <ParentSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: NEU.bg },
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingOrb: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, paddingTop: 16,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.7, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  title: { fontSize: 18, fontWeight: '700', color: NEU.text },

  childPicker: { marginBottom: 8 },
  childChip: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, marginRight: 8, borderWidth: 1,
    backgroundColor: NEU.bg, borderColor: NEU.bgDark,
  },
  childChipText: { fontSize: 13, color: NEU.textMuted },

  childInfoCard: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, padding: 16, marginBottom: 16, gap: 16,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  childName: { fontSize: 15, fontWeight: '600', color: NEU.text },
  childMeta: { fontSize: 11, color: NEU.textMuted, marginTop: 2 },

  subjectCard: {
    borderRadius: 20, marginBottom: 10, overflow: 'hidden',
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.55, shadowRadius: 10, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  subjectHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12,
  },
  subjectName: { fontSize: 14, fontWeight: '600', color: NEU.text },
  subjectCode: { fontSize: 11, color: NEU.textMuted, marginTop: 2 },
  avgBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  avgText: { fontSize: 14, fontWeight: '800' },

  quartersContainer: {
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: NEU.bgDark,
  },
  quarterRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(209,217,230,0.5)',
  },
  quarterLabel: { fontSize: 13, color: NEU.textMuted },
  quarterValue: { fontSize: 14, fontWeight: '700' },
  remarksRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 10, marginTop: 4,
  },
  remarksLabel: { fontSize: 13, color: NEU.textMuted },
  remarksValue: { fontSize: 13, fontWeight: '700' },

  emptyContainer: {
    alignItems: 'center', padding: 40, borderRadius: 20,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  emptyText: { fontSize: 15, color: NEU.textMuted, marginTop: 16, fontWeight: '600' },
});