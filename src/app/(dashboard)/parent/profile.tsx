import { useTheme } from '@/app/_context/themecontext';
import NotificationBell from '@/components/NotificationBell';
import { supabase } from '@/lib/supabase/client';
import { logLogout, logMyActivity } from '@/services/activityLog';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  address: string;
  role: string;
};

type Child = {
  id: string;
  full_name: string;
  grade_level: string;
  strand: string;
  lrn: string;
  section_name: string;
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

export default function ParentProfile() {
  const router = useRouter();
  const { primaryColor, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    address: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        setLoading(false);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role, contact_number, address')
        .eq('email', email)
        .maybeSingle();

      if (!userData) {
        setLoading(false);
        return;
      }

      const { data: kids } = await supabase
        .from('students')
        .select(`
          id, first_name, last_name, lrn, grade_level, strand,
          sections:section_id (name)
        `)
        .eq('parent_id', userData.id);

      const mappedKids: Child[] = (kids || []).map((k: any) => {
        const sectionRel = Array.isArray(k.sections) ? k.sections[0] : k.sections;
        return {
          id: k.id,
          full_name: `${k.first_name || ''} ${k.last_name || ''}`.trim() || 'Unknown',
          grade_level: k.grade_level || 'N/A',
          strand: k.strand || 'N/A',
          lrn: k.lrn || 'N/A',
          section_name: sectionRel?.name || 'No Section',
        };
      });

      setChildren(mappedKids);

      const profileData: Profile = {
        id: userData.id,
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || email,
        contact_number: userData.contact_number || 'N/A',
        address: userData.address || 'N/A',
        role: userData.role || 'parent',
      };

      setProfile(profileData);

      setEditForm({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: profileData.email,
        contact_number: profileData.contact_number === 'N/A' ? '' : profileData.contact_number,
        address: profileData.address === 'N/A' ? '' : profileData.address,
      });
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    setSaving(true);
    try {
      const cleanEmail = editForm.email.trim().toLowerCase();

      const { error: userError } = await supabase
        .from('users')
        .update({
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          email: cleanEmail,
          contact_number: editForm.contact_number.trim() || null,
          address: editForm.address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile?.id);

      if (userError) throw userError;

      if (children.length > 0) {
        await supabase
          .from('students')
          .update({
            parent_name: `${editForm.first_name.trim()} ${editForm.last_name.trim()}`,
            parent_contact: editForm.contact_number.trim() || null,
          })
          .in('id', children.map(c => c.id));
      }

      if (cleanEmail !== profile?.email) {
        await AsyncStorage.setItem('userEmail', cleanEmail);
      }

      await logMyActivity(
        'profile_updated',
        '✏️ Profile Updated',
        'Your personal information was updated.',
        { screen: '/parent/profile' }
      );

      Alert.alert('Success', 'Profile updated successfully!');
      setEditModalVisible(false);
      await loadProfile();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logLogout();
            const keys = [
              'userEmail', 'userId', 'userRole',
              'parentName', 'parentInfo',
              'studentName', 'studentInfo',
              'teacherName', 'teacherInfo',
              'currentUser',
            ];
            for (const key of keys) await AsyncStorage.removeItem(key);
            router.replace('/(auth)/login');
          } catch {
            router.replace('/(auth)/login');
          }
        },
      },
    ]);
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

  const initials = profile
    ? `${(profile.first_name || '').charAt(0)}${(profile.last_name || '').charAt(0)}`.toUpperCase() || 'P'
    : 'P';

  const fullName = profile
    ? `${profile.first_name} ${profile.last_name}`.trim() || 'Parent'
    : 'Parent';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={20} color={NEU.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Profile</Text>
          <NotificationBell iconColor={NEU.text} />
        </View>

        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: primaryColor + '15' }]}>
            <Text style={[styles.avatarText, { color: primaryColor }]}>{initials}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: primaryColor + '15' }]}>
            <Ionicons name="people" size={12} color={primaryColor} />
            <Text style={[styles.roleText, { color: primaryColor }]}>Parent</Text>
          </View>
          <Text style={styles.email}>{profile?.email}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <TouchableOpacity style={styles.editButton} onPress={() => setEditModalVisible(true)}>
              <Ionicons name="create" size={14} color={primaryColor} />
              <Text style={[styles.editButtonText, { color: primaryColor }]}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <Text style={styles.infoValue}>{fullName}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{profile?.email}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Contact</Text>
            <Text style={styles.infoValue}>{profile?.contact_number}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue} numberOfLines={2}>{profile?.address}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Children ({children.length})</Text>
          </View>

          {children.length > 0 ? (
            children.map((c, idx) => (
              <View key={c.id} style={[styles.childItem, idx === children.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.childAvatar, { backgroundColor: primaryColor + '15' }]}>
                  <Text style={[styles.childInitial, { color: primaryColor }]}>
                    {c.full_name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{c.full_name}</Text>
                  <Text style={styles.childMeta}>LRN: {c.lrn}</Text>
                  <Text style={styles.childMeta}>
                    Grade {c.grade_level}
                    {c.strand !== 'N/A' ? ` • ${c.strand}` : ''} • {c.section_name}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noData}>No children linked yet.</Text>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color={NEU.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={NEU.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.first_name}
                  onChangeText={(text) => setEditForm({ ...editForm, first_name: text })}
                  placeholder="Enter first name"
                  placeholderTextColor={NEU.textFaint}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.last_name}
                  onChangeText={(text) => setEditForm({ ...editForm, last_name: text })}
                  placeholder="Enter last name"
                  placeholderTextColor={NEU.textFaint}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.email}
                  onChangeText={(text) => setEditForm({ ...editForm, email: text })}
                  placeholder="Enter email"
                  placeholderTextColor={NEU.textFaint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Number</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.contact_number}
                  onChangeText={(text) => setEditForm({ ...editForm, contact_number: text })}
                  placeholder="Enter contact number"
                  placeholderTextColor={NEU.textFaint}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editForm.address}
                  onChangeText={(text) => setEditForm({ ...editForm, address: text })}
                  placeholder="Enter address"
                  placeholderTextColor={NEU.textFaint}
                  multiline
                  numberOfLines={3}
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setEditModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleUpdateProfile}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={primaryColor} />
                  ) : (
                    <Text style={[styles.saveButtonText, { color: primaryColor }]}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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

  profileCard: {
    borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 16,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.6, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: NEU.text, marginTop: 16 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8,
  },
  roleText: { fontSize: 11, fontWeight: '700' },
  email: { fontSize: 13, color: NEU.textMuted, marginTop: 8 },

  infoCard: {
    borderRadius: 20, padding: 20, marginBottom: 16,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 5,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: NEU.text },
  editButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 2,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: 'rgba(163,177,198,0.4)',
    borderLeftColor: 'rgba(163,177,198,0.4)',
  },
  editButtonText: { fontSize: 13, fontWeight: '700' },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 12,
  },
  infoLabel: { fontSize: 13, color: NEU.textMuted },
  infoValue: {
    fontSize: 13, fontWeight: '600', color: NEU.text,
    flex: 1, textAlign: 'right', marginLeft: 16,
  },
  divider: { height: 1, backgroundColor: NEU.bgDark, opacity: 0.5 },

  childItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(209,217,230,0.5)',
  },
  childAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  childInitial: { fontSize: 15, fontWeight: '800' },
  childName: { fontSize: 14, fontWeight: '600', color: NEU.text },
  childMeta: { fontSize: 11, color: NEU.textMuted, marginTop: 2 },
  noData: { fontSize: 13, color: NEU.textMuted, textAlign: 'center', paddingVertical: 16 },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, padding: 16, gap: 8, marginBottom: 24,
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  logoutText: { fontSize: 15, color: NEU.danger, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(46,58,77,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: NEU.bg,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
    shadowColor: NEU.darkShadow, shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
    borderTopWidth: 1, borderTopColor: NEU.lightShadow,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: NEU.bgDark,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: NEU.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 2,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: 'rgba(163,177,198,0.4)',
    borderLeftColor: 'rgba(163,177,198,0.4)',
  },
  modalBody: { maxHeight: '90%' },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: NEU.text, marginBottom: 6 },
  input: {
    borderRadius: 12, padding: 16,
    fontSize: 14, color: NEU.text, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 2,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: 'rgba(163,177,198,0.4)',
    borderLeftColor: 'rgba(163,177,198,0.4)',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16 },
  modalButton: { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center' },
  cancelButton: {
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 4, elevation: 2,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: 'rgba(163,177,198,0.4)',
    borderLeftColor: 'rgba(163,177,198,0.4)',
  },
  cancelButtonText: { color: NEU.text, fontSize: 14, fontWeight: '600' },
  saveButton: {
    backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  saveButtonText: { fontSize: 14, fontWeight: '700' },
});