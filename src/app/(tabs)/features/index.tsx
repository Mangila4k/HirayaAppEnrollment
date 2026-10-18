import { spacing, typography } from '@/styles';
import { Ionicons } from '@expo/vector-icons';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MATATAG_BG = require('@assets/images/matatag-bg.jpg');

const THEME = {
  royalBlue: '#1E3A8A',
  yellow: '#F5C518',
  white: '#FFFFFF',
  offWhite: '#F5F7FA',
  lightGray: '#E5EAF2',
  gray: '#8A94A6',
  black: '#1A202C',
};

export default function FeaturesPage() {
  const features = [
    { icon: 'people-outline', title: 'Student Management', desc: 'Complete student profile management with easy access to records.' },
    { icon: 'document-text-outline', title: 'Paperless Enrollment', desc: 'Submit requirements online, no more physical documents.' },
    { icon: 'notifications-outline', title: 'Real-time Notifications', desc: 'Get instant updates on your enrollment status.' },
    { icon: 'shield-checkmark-outline', title: 'Data Security', desc: 'Your information is protected with enterprise-grade security.' },
    { icon: 'phone-portrait-outline', title: '24/7 Accessibility', desc: 'Access the system anytime, anywhere from any device.' },
    { icon: 'pie-chart-outline', title: 'Analytics Dashboard', desc: 'Track enrollment trends with comprehensive reports.' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HERO BANNER ===== */}
        <ImageBackground
          source={MATATAG_BG}
          style={styles.heroBanner}
          imageStyle={styles.heroImage}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Features</Text>
            <Text style={styles.heroSubtitle}>
              Discover what makes PLSNHS the best choice.
            </Text>
          </View>
        </ImageBackground>

        {/* ===== FEATURES GRID ===== */}
        <View style={styles.body}>
          <View style={styles.grid}>
            {features.map((f, i) => (
              <View key={i} style={styles.card}>
                <View style={styles.iconContainer}>
                  <Ionicons name={f.icon as any} size={26} color={THEME.royalBlue} />
                </View>
                <Text style={styles.cardTitle}>{f.title}</Text>
                <Text style={styles.cardDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.white },
  container: { flex: 1 },
  contentContainer: { paddingBottom: spacing.xl },

  // ===== Hero banner =====
  heroBanner: {
    width: '100%',
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,58,138,0.65)',
  },
  heroContent: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  heroTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: '800',
    color: THEME.white,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroSubtitle: {
    fontSize: typography.sizes.md,
    color: THEME.yellow,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ===== Body =====
  body: { padding: spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  card: {
    backgroundColor: THEME.offWhite,
    borderRadius: 16,
    padding: spacing.lg,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: '#EEF2FF',
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: THEME.black,
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 11,
    color: THEME.gray,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
});