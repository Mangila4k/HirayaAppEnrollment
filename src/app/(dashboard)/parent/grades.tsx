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

const THEME = {
  bg: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E5EAF2',
  royalBlue: '#1E3A8A',
  royalBlueSoft: 'rgba(30,58,138,0.10)',
  text: '#1A202C',
  textMuted: '#8A94A6',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export default function ParentGrades() {
  const { primaryColor } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => { loadChildren(); }, []);
  useEffect(() => { if (selectedChild) loadGrades(selectedChild); }, [selectedChild]);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;

      const { data: userData } = await supabase.from('users').select('id, last_name').eq('email', email).maybeSingle();
      if (!userData) return;

      let kids = [];
      const { data: linkedKids } = await supabase.from('students').select('*').eq('parent_id', userData.id);
      if (linkedKids && linkedKids.length > 0) {
        kids = linkedKids;
      } else {
        const lastName = userData.last_name || '';
        if (lastName) {
          const { data: fallback } = await supabase.from('students').select('*').or(`last_name.ilike.%${lastName}%,parent_name.ilike.%${lastName}%`);
          if (fallback) kids = fallback;
        }
      }

      if (kids.length > 0) {
        const list = kids.map((k: any) => ({
          id: k.id,
          full_name: `${k.first_name || ''} ${k.last_name || ''}`.trim(),
          grade_level: k.grade_level || 'N/A',
        }));
        setChildren(list);
        setSelectedChild(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadGrades = async (child: any) => {
    setLoading(true);
    try {
      const { data: gradeData } = await supabase
        .from('grades')
        .select('subject_id, quarter, grade')
        .eq('student_id', child.id);

      if (!gradeData || gradeData.length === 0) {
        setSubjects([]);
        return;
      }

      const subjectIds = [...new Set(gradeData.map(g => g.subject_id))];
      const { data: subData } = await supabase.from('subjects').select('id, name, code').in('id', subjectIds);
      
      const subMap: Record<string, any> = {};
      (subData || []).forEach(s => { subMap[s.id] = s; });

      const grouped: Record<string, any> = {};
      gradeData.forEach(g => {
        if (!grouped[g.subject_id]) {
          grouped[g.subject_id] = {
            subject_name: subMap[g.subject_id]?.name || 'Unknown',
            subject_code: subMap[g.subject_id]?.code || '',
            quarters: {},
          };
        }
        grouped[g.subject_id].quarters[g.quarter] = g.grade;
      });

      const result = Object.values(grouped).map((sub: any) => {
        const q1 = sub.quarters[1] || null;
        const q2 = sub.quarters[2] || null;
        const q3 = sub.quarters[3] || null;
        const q4 = sub.quarters[4] || null;
        
        let final = null;
        if (q1 !== null && q2 !== null && q3 !== null && q4 !== null) {
          final = Math.round(((q1 + q2 + q3 + q4) / 4) * 100) / 100;
        }
        
        return { ...sub, final };
      });

      setSubjects(result);
    } finally {
      setLoading(false);
    }
  };

  const gradeColor = (g: number | null) => {
    if (g === null) return THEME.textMuted;
    if (g >= 90) return THEME.success;
    if (g >= 85) return '#8BC34A';
    if (g >= 75) return THEME.warning;
    return THEME.danger;
  };

  if (loading && children.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={primaryColor} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowSidebar(true)} style={styles.iconBtn}>
            <Ionicons name="menu-outline" size={22} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Grades</Text>
          <View style={{ width: 44 }} />
        </View>

        {children.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {children.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.childChip, selectedChild?.id === c.id && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                onPress={() => setSelectedChild(c)}
              >
                <Text style={[styles.childChipText, selectedChild?.id === c.id && { color: '#fff', fontWeight: '700' }]}>
                  {c.full_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedChild && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <View style={[styles.avatar, { backgroundColor: primaryColor + '15' }]}>
                <Text style={[styles.avatarText, { color: primaryColor }]}>{selectedChild.full_name.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.name}>{selectedChild.full_name}</Text>
                <Text style={styles.meta}>{selectedChild.grade_level}</Text>
              </View>
            </View>

            {subjects.length === 0 ? (
              <Text style={{ color: THEME.textMuted, textAlign: 'center', padding: 20 }}>No grades published yet.</Text>
            ) : (
              subjects.map((sub, i) => (
                <View key={i} style={styles.subjectCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={styles.subjectName}>{sub.subject_name}</Text>
                    <View style={[styles.badge, { backgroundColor: gradeColor(sub.final) + '20' }]}>
                      <Text style={[styles.badgeText, { color: gradeColor(sub.final) }]}>
                        {sub.final !== null ? sub.final : '—'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    {[1, 2, 3, 4].map(q => (
                      <View key={q} style={styles.quarterBox}>
                        <Text style={styles.quarterLabel}>Q{q}</Text>
                        <Text style={[styles.quarterVal, { color: sub.quarters[q] ? gradeColor(sub.quarters[q]) : THEME.textMuted }]}>
                          {sub.quarters[q] || '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>
      <ParentSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.bg },
  container: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  title: { fontSize: 18, fontWeight: '700', color: THEME.text },
  childChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, backgroundColor: THEME.card, borderColor: THEME.border },
  childChipText: { fontSize: 13, color: THEME.textMuted },
  card: { padding: 20, borderRadius: 16, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '700', color: THEME.text },
  meta: { fontSize: 12, color: THEME.textMuted },
  subjectCard: { padding: 12, backgroundColor: THEME.bg, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: THEME.border },
  subjectName: { fontSize: 14, fontWeight: '700', color: THEME.text },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  quarterBox: { flex: 1, backgroundColor: THEME.card, padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: THEME.border },
  quarterLabel: { fontSize: 10, fontWeight: '600', color: THEME.textMuted },
  quarterVal: { fontSize: 14, fontWeight: '800', marginTop: 2 },
});