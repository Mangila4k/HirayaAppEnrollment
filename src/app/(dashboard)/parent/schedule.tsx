import { useTheme } from '@/app/_context/themecontext';
import ParentSidebar from '@/components/ParentSidebar';
import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const THEME = {
  bg: '#F5F7FA',
  card: '#FFFFFF',
  border: '#E5EAF2',
  royalBlue: '#1E3A8A',
  royalBlueSoft: 'rgba(30,58,138,0.10)',
  text: '#1A202C',
  textMuted: '#8A94A6',
};

export default function ParentSchedule() {
  const { primaryColor } = useTheme();
  const [showSidebar, setShowSidebar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any | null>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('Monday');
  const [uploadedDoc, setUploadedDoc] = useState<any>(null);

  useEffect(() => { loadChildren(); }, []);
  useEffect(() => { if (selectedChild) loadSchedule(selectedChild); }, [selectedChild]);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;

      const { data: userData } = await supabase.from('users').select('id, last_name').eq('email', email).maybeSingle();
      if (!userData) return;

      let kids: any[] = [];
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
          section_id: k.section_id,
        }));
        setChildren(list);
        setSelectedChild(list[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSchedule = async (child: any) => {
    setLoading(true);
    try {
      if (!child.section_id) { setSchedules([]); return; }

      const { data: sec } = await supabase
        .from('sections')
        .select('schedule_doc_url, schedule_doc_name, schedule_doc_type, shared_at')
        .eq('id', child.section_id)
        .maybeSingle();

      if (sec && sec.schedule_doc_url && sec.shared_at) {
        setUploadedDoc({
          url: sec.schedule_doc_url,
          name: sec.schedule_doc_name || 'Official Student Load',
        });
      } else {
        setUploadedDoc(null);
      }

      const { data: scheds } = await supabase
        .from('schedules')
        .select('*')
        .eq('section_id', child.section_id)
        .order('start_time');

      if (scheds) {
        const subIds = [...new Set(scheds.map(s => s.subject_id))];
        const { data: subs } = await supabase.from('subjects').select('id, name, code').in('id', subIds);
        const subMap: Record<string, any> = {};
        (subs || []).forEach((s) => { subMap[s.id] = s; });

        const formatted = scheds.map((s: any) => ({
          ...s,
          subject_name: subMap[s.subject_id]?.name || 'Class',
          subject_code: subMap[s.subject_id]?.code || '',
        }));
        
        setSchedules(formatted);
        const firstDay = DAYS.find(d => formatted.some(s => s.day === d));
        if (firstDay) setSelectedDay(firstDay);
      }
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.title}>Class Program</Text>
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
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16, color: THEME.text }}>
              {selectedChild.full_name} - {selectedChild.grade_level}
            </Text>
            
            {uploadedDoc ? (
              <View style={styles.docCard}>
                <Ionicons name="document-text" size={30} color={primaryColor} />
                <Text style={styles.docTitle}>Official Student Load Uploaded</Text>
                <Text style={styles.docSub}>{uploadedDoc.name}</Text>
                <TouchableOpacity style={[styles.btn, { backgroundColor: primaryColor }]} onPress={() => Linking.openURL(uploadedDoc.url)}>
                  <Text style={styles.btnText}>View Schedule Document</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {DAYS.map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayChip, selectedDay === d && { backgroundColor: primaryColor, borderColor: primaryColor }]}
                      onPress={() => setSelectedDay(d)}
                    >
                      <Text style={{ color: selectedDay === d ? '#fff' : THEME.textMuted, fontWeight: '600' }}>{d.slice(0, 3)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {schedules.filter(s => s.day === selectedDay).length === 0 ? (
                  <Text style={{ textAlign: 'center', color: THEME.textMuted, padding: 20 }}>No classes on {selectedDay}.</Text>
                ) : (
                  schedules.filter(s => s.day === selectedDay).map((s, i) => (
                    <View key={i} style={styles.scheduleRow}>
                      <Text style={[styles.scheduleTime, { color: primaryColor }]}>{s.start_time?.slice(0, 5)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.scheduleSub}>{s.subject_name}</Text>
                        <Text style={styles.scheduleMeta}>{s.room || 'Room TBA'}</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
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
  docCard: { alignItems: 'center', padding: 20, backgroundColor: THEME.bg, borderRadius: 16, borderWidth: 1, borderColor: THEME.border },
  docTitle: { fontSize: 14, fontWeight: '700', color: THEME.text, marginTop: 10 },
  docSub: { fontSize: 12, color: THEME.textMuted, marginBottom: 16 },
  btn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dayChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginRight: 8, backgroundColor: THEME.card, borderWidth: 1, borderColor: THEME.border },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: THEME.border, gap: 16 },
  scheduleTime: { fontSize: 13, fontWeight: '700', width: 50 },
  scheduleSub: { fontSize: 14, fontWeight: '600', color: THEME.text },
  scheduleMeta: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
});