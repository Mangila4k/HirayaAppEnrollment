import { ACCENT_PRESETS, useTheme } from '@/app/_context/themecontext';
import { colors, spacing, typography } from '@/styles';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.78, 320);

const NAV_ITEMS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}[] = [
  { key: 'index', label: 'Dashboard', icon: 'grid', route: '/(dashboard)/parent' },
  { key: 'grades', label: 'Grades', icon: 'star', route: '/(dashboard)/parent/grades' },
  { key: 'attendance', label: 'Attendance', icon: 'calendar', route: '/(dashboard)/parent/attendance' },
  { key: 'schedule', label: 'Schedule', icon: 'time', route: '/(dashboard)/parent/schedule' },
  { key: 'profile', label: 'Profile', icon: 'person-circle', route: '/(dashboard)/parent/profile' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ParentSidebar({ visible, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { isDark, setIsDark, primaryColor, setPrimaryColor, theme } = useTheme();
  const [parentName, setParentName] = useState('Parent');
  const [parentInfo, setParentInfo] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const load = async () => {
      const name = await AsyncStorage.getItem('parentName');
      const info = await AsyncStorage.getItem('parentInfo');
      if (name) setParentName(name);
      if (info) setParentInfo(info);
    };
    load();
  }, [visible]);

  const handleNavigate = (route: string) => {
    onClose();
    setTimeout(() => router.push(route as any), 180);
  };

    // ===== SIGN OUT (functional) =====
  const handleLogout = () => {
    onClose();

    setTimeout(() => {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              try {
                // Navigate first so the UI switches immediately
                router.replace('/(auth)/login' as any);

                // Then clear everything
                const keys = [
                  'userEmail',
                  'userId',
                  'userRole',
                  'parentName',
                  'parentInfo',
                  'studentName',
                  'studentInfo',
                  'teacherName',
                  'teacherInfo',
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
        ],
        { cancelable: true }
      );
    }, 200);
  };

  const getInitials = () => {
    const parts = parentName.split(' ').filter(Boolean);
    if (parts.length === 0) return 'P';
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.key === 'index') {
      return pathname === '/(dashboard)/parent' || pathname.endsWith('/parent');
    }
    return pathname.includes(`/parent/${item.key}`);
  };

  return (
    <>
      {/* ===== NAV DRAWER ===== */}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

          <View style={[styles.panel, { backgroundColor: theme.card }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
              <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {parentName}
              </Text>
              {parentInfo ? (
                <Text style={[styles.info, { color: theme.textMuted }]} numberOfLines={1}>
                  {parentInfo}
                </Text>
              ) : null}
            </View>

            {/* Nav */}
            <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
              {NAV_ITEMS.map(item => {
                const active = isActive(item);
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.navItem,
                      active && { backgroundColor: primaryColor + '15' },
                    ]}
                    onPress={() => handleNavigate(item.route)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.navIcon,
                        {
                          backgroundColor: active
                            ? primaryColor + '20'
                            : theme.background,
                        },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={active ? primaryColor : theme.textMuted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.navLabel,
                        {
                          color: active ? primaryColor : theme.text,
                          fontWeight: active ? '700' : '500',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                    {active && (
                      <View style={[styles.activeDot, { backgroundColor: primaryColor }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: theme.cardBorder }]}>
              <TouchableOpacity
                style={styles.footerBtn}
                onPress={() => {
                  onClose();
                  setTimeout(() => setShowSettings(true), 180);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="color-palette" size={18} color={primaryColor} />
                <Text style={[styles.footerText, { color: theme.text }]}>Appearance</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerBtn} onPress={handleLogout} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={18} color={colors.error} />
                <Text style={[styles.footerText, { color: colors.error }]}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== SETTINGS MODAL (Theme Color Changer) ===== */}
      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.settingsSheet, { backgroundColor: theme.background }]}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, { color: theme.text }]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>APPEARANCE</Text>

              {/* Dark Mode toggle */}
              <View
                style={[
                  styles.settingRow,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <View style={[styles.settingIcon, { backgroundColor: primaryColor + '20' }]}>
                  <Ionicons name="moon" size={20} color={primaryColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: theme.text }]}>Dark Mode</Text>
                  <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                    {isDark ? 'Currently on' : 'Currently off'}
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={setIsDark}
                  trackColor={{ false: '#d1d5db', true: primaryColor + '80' }}
                  thumbColor={isDark ? primaryColor : '#f4f3f4'}
                />
              </View>

              {/* Theme color picker */}
              <View
                style={[
                  styles.colorCard,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <View style={styles.colorHeader}>
                  <View style={[styles.settingIcon, { backgroundColor: primaryColor + '20' }]}>
                    <Ionicons name="color-palette" size={20} color={primaryColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingTitle, { color: theme.text }]}>Theme Color</Text>
                    <Text style={[styles.settingSub, { color: theme.textMuted }]}>
                      Pick your accent color
                    </Text>
                  </View>
                </View>
                <View style={styles.colorGrid}>
                  {ACCENT_PRESETS.map(preset => {
                    const selected = primaryColor === preset.value;
                    return (
                      <TouchableOpacity
                        key={preset.value}
                        style={styles.colorOption}
                        onPress={() => setPrimaryColor(preset.value)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.colorSwatch,
                            { backgroundColor: preset.value },
                            selected && { borderWidth: 3, borderColor: theme.text },
                          ]}
                        >
                          {selected && (
                            <Ionicons name="checkmark" size={20} color={colors.white} />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.colorName,
                            { color: selected ? theme.text : theme.textMuted },
                          ]}
                        >
                          {preset.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row' },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    paddingTop: 60,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.white, fontSize: 22, fontWeight: '700' },
  name: { fontSize: typography.sizes.md, fontWeight: '700' },
  info: { fontSize: typography.sizes.xs, marginTop: 2 },

  nav: { flex: 1, paddingTop: spacing.md },
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: 6,
  },
  navIcon: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  navLabel: { flex: 1, fontSize: typography.sizes.sm },
  activeDot: { width: 8, height: 8, borderRadius: 4 },

  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  footerBtn: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  footerText: { fontSize: typography.sizes.sm, fontWeight: '500' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  settingsSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  settingsTitle: { fontSize: typography.sizes.xl, fontWeight: '700' },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  settingIcon: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.md,
  },
  settingTitle: { fontSize: typography.sizes.sm, fontWeight: '600' },
  settingSub: { fontSize: typography.sizes.xs, marginTop: 1 },
  colorCard: { borderRadius: 14, padding: spacing.md, borderWidth: 1 },
  colorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  colorOption: { width: '23%', alignItems: 'center', marginBottom: spacing.md },
  colorSwatch: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.xs,
  },
  colorName: { fontSize: typography.sizes.xs },
});