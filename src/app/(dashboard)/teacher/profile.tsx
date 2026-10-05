import NotificationBell from '@/components/NotificationBell';
import { supabase } from '@/lib/supabase/client';
import { logMyActivity } from '@/services/activityLog';
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

type TeacherProfile = {
  id: string;
  user_id: string;
  employee_id: string;
  specialization: string;
  phone: string;
  address: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
};

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

export default function TeacherProfile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    specialization: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
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
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      if (userError || !userData) {
        setLoading(false);
        return;
      }
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', userData.id)
        .maybeSingle();
      const profileData: TeacherProfile = {
        id: teacherData?.id || userData.id,
        user_id: userData.id,
        employee_id: teacherData?.employee_id || 'N/A',
        specialization: teacherData?.specialization || 'N/A',
        phone: teacherData?.phone || 'N/A',
        address: teacherData?.address || 'N/A',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        email: userData.email || '',
        created_at: userData.created_at,
      };
      setProfile(profileData);
      setEditForm({
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone: profileData.phone === 'N/A' ? '' : profileData.phone,
        address: profileData.address === 'N/A' ? '' : profileData.address,
        specialization: profileData.specialization === 'N/A' ? '' : profileData.specialization,
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
      const { error: userError } = await supabase
        .from('users')
        .update({
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile?.user_id);
      if (userError) throw userError;
      if (profile?.id && profile.id !== profile.user_id) {
        const { error: teacherError } = await supabase
          .from('teachers')
          .update({
            phone: editForm.phone.trim() || null,
            address: editForm.address.trim() || null,
            specialization: editForm.specialization.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
        if (teacherError) throw teacherError;
      }
      await logMyActivity(
        'profile_updated',
        '✏️ Profile Updated',
        'Your personal information was updated.',
        { screen: '/(dashboard)/teacher/profile' }
      );
      Alert.alert('Success', 'Profile updated successfully!');
      setEditModalVisible(false);
      await loadProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('password')
        .eq('id', profile?.user_id)
        .single();
      if (userData?.password !== passwordForm.currentPassword) {
        Alert.alert('Error', 'Current password is incorrect');
        setChangingPassword(false);
        return;
      }
      const { error } = await supabase
        .from('users')
        .update({ password: passwordForm.newPassword })
        .eq('id', profile?.user_id);
      if (error) throw error;
      await logMyActivity(
        'password_changed',
        '🔒 Password Changed',
        'Your account password was changed.',
        { screen: '/(dashboard)/teacher/profile' }
      );
      Alert.alert('Success', 'Password changed successfully!');
      setPasswordModalVisible(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            router.replace('/(auth)/login' as any);
            const keys = [
              'userEmail',
              'userId',
              'userRole',
              'teacherName',
              'teacherInfo',
              'parentName',
              'parentInfo',
              'studentName',
              'studentInfo',
              'currentUser',
            ];
            for (const key of keys) {
              await AsyncStorage.removeItem(key);
            }
          } catch (e) {
            console.error('Logout error:', e);
            router.replace('/(auth)/login' as any);
          }
        },
      },
    ]);
  };

  const getInitials = () => {
    if (!profile) return 'T';
    return (
      `${profile.first_name?.charAt(0) || ''}${profile.last_name?.charAt(0) || ''}`.toUpperCase() || 'T'
    );
  };

  const getFullName = () => {
    if (!profile) return 'Teacher';
    return (
      `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
      profile.email?.split('@')[0] ||
      'Teacher'
    );
  };

  const getSpecializationColor = (spec: string) => {
    switch (spec.toLowerCase()) {
      case 'science':
        return '#4CAF50';
      case 'english':
        return '#2196F3';
      case 'mathematics':
        return '#FF9800';
      case 'esp':
        return '#9C27B0';
      case 'filipino':
        return '#E91E63';
      default:
        return NEU.accent;
    }
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

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No profile found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const specColor = getSpecializationColor(profile.specialization);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={NEU.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.greeting}>My Profile</Text>
            <Text style={styles.subGreeting}>Personal information</Text>
          </View>
          <NotificationBell iconColor={NEU.text} />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: specColor }]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={styles.profileName}>{getFullName()}</Text>
          <Text style={styles.profileEmail}>{profile.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: specColor + '20' }]}>
            <Ionicons name="briefcase" size={14} color={specColor} />
            <Text style={[styles.roleText, { color: specColor }]}>{profile.specialization}</Text>
          </View>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Teacher Information</Text>
            <TouchableOpacity style={styles.editChip} onPress={() => setEditModalVisible(true)}>
              <Ionicons name="create-outline" size={14} color={NEU.accent} />
              <Text style={styles.editChipText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Employee ID</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile.employee_id}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Specialization</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile.specialization}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile.email}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile.phone}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile.address}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {profile.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'N/A'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => setPasswordModalVisible(true)}
          activeOpacity={0.85}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons name="key-outline" size={18} color={NEU.accent} />
          </View>
          <Text style={styles.actionText}>Change Password</Text>
          <Ionicons name="chevron-forward" size={16} color={NEU.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={handleLogout} activeOpacity={0.85}>
          <View style={[styles.actionIconWrap, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="log-out-outline" size={18} color={NEU.danger} />
          </View>
          <Text style={[styles.actionText, { color: NEU.danger }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={16} color={NEU.textFaint} />
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Modal */}
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
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={NEU.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.first_name}
                  onChangeText={t => setEditForm({ ...editForm, first_name: t })}
                  placeholder="Enter first name"
                  placeholderTextColor={NEU.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.last_name}
                  onChangeText={t => setEditForm({ ...editForm, last_name: t })}
                  placeholder="Enter last name"
                  placeholderTextColor={NEU.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Specialization</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.specialization}
                  onChangeText={t => setEditForm({ ...editForm, specialization: t })}
                  placeholder="e.g., Science, English"
                  placeholderTextColor={NEU.textMuted}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.phone}
                  onChangeText={t => setEditForm({ ...editForm, phone: t })}
                  placeholder="09123456789"
                  placeholderTextColor={NEU.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editForm.address}
                  onChangeText={t => setEditForm({ ...editForm, address: t })}
                  placeholder="Enter address"
                  placeholderTextColor={NEU.textMuted}
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
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Password Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={passwordModalVisible}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={24} color={NEU.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password *</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.currentPassword}
                  onChangeText={t => setPasswordForm({ ...passwordForm, currentPassword: t })}
                  placeholder="Enter current password"
                  placeholderTextColor={NEU.textMuted}
                  secureTextEntry
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password *</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.newPassword}
                  onChangeText={t => setPasswordForm({ ...passwordForm, newPassword: t })}
                  placeholder="Min 6 characters"
                  placeholderTextColor={NEU.textMuted}
                  secureTextEntry
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password *</Text>
                <TextInput
                  style={styles.input}
                  value={passwordForm.confirmPassword}
                  onChangeText={t => setPasswordForm({ ...passwordForm, confirmPassword: t })}
                  placeholder="Confirm new password"
                  placeholderTextColor={NEU.textMuted}
                  secureTextEntry
                />
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setPasswordModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleChangePassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Update</Text>
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
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 13, color: NEU.textMuted, marginBottom: 12 },
  loadingOrb: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: NEU.bg,
    shadowColor: NEU.lightShadow, shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 6,
  },
  retryButton: {
    marginTop: 8, backgroundColor: NEU.accent,
    paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12,
  },
  retryButtonText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 20,
  },
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

  profileCard: {
    alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20,
    borderRadius: 20, backgroundColor: NEU.bg, marginBottom: 20,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#FFF' },
  profileName: { fontSize: 18, fontWeight: '800', color: NEU.text, letterSpacing: -0.3 },
  profileEmail: { fontSize: 12, color: NEU.textMuted, marginTop: 4 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginTop: 10,
  },
  roleText: { fontSize: 12, fontWeight: '700' },

  infoCard: {
    paddingVertical: 8, paddingHorizontal: 20, marginBottom: 20,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 6,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 14, paddingBottom: 4,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: NEU.textFaint,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(76,111,255,0.12)',
  },
  editChipText: { fontSize: 11, fontWeight: '700', color: NEU.accent },

  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 14,
  },
  infoLabel: { fontSize: 13, color: NEU.textMuted, letterSpacing: 0.3 },
  infoValue: {
    fontSize: 13, fontWeight: '600', color: NEU.text,
    flex: 1, textAlign: 'right', marginLeft: 16,
  },
  divider: { height: 1, backgroundColor: NEU.bgDark, opacity: 0.5 },

  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 18, marginBottom: 10,
    borderRadius: 20, backgroundColor: NEU.bg,
    shadowColor: NEU.darkShadow, shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 10, elevation: 4,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderTopColor: NEU.lightShadow, borderLeftColor: NEU.lightShadow,
  },
  actionIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(76,111,255,0.12)',
  },
  actionText: { flex: 1, fontSize: 14, fontWeight: '600', color: NEU.text },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(46,58,77,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: NEU.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: NEU.bgDark,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: NEU.text },

  inputGroup: { marginBottom: 14 },
  inputLabel: {
    fontSize: 11, fontWeight: '700', color: NEU.textFaint,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    borderWidth: 1.5, borderColor: NEU.bgDark, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: NEU.text, backgroundColor: NEU.bg,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },

  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 8 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  cancelButton: { backgroundColor: NEU.bg, borderWidth: 1.5, borderColor: NEU.bgDark },
  cancelButtonText: { color: NEU.text, fontSize: 14, fontWeight: '600' },
  saveButton: { backgroundColor: NEU.accent },
  saveButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});