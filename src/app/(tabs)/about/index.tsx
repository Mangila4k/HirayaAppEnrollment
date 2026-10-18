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

export default function AboutPage() {
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
            <Text style={styles.heroTitle}>About PLSNHS</Text>
            <Text style={styles.heroSubtitle}>
              Learn more about our mission and vision.
            </Text>
          </View>
        </ImageBackground>

        {/* ===== CARDS ===== */}
        <View style={styles.body}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="radio-button-on" size={26} color={THEME.royalBlue} />
            </View>
            <Text style={styles.cardTitle}>Our Mission</Text>
            <Text style={styles.cardDesc}>
              To provide accessible, efficient, and quality enrollment management services
              for students and stakeholders of Placido L. Señor NHS Enrollment System.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="eye" size={26} color={THEME.royalBlue} />
            </View>
            <Text style={styles.cardTitle}>Our Vision</Text>
            <Text style={styles.cardDesc}>
              To be the leading enrollment management system in the region, setting the
              standard for innovation and excellence in education administration.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="heart" size={26} color={THEME.royalBlue} />
            </View>
            <Text style={styles.cardTitle}>Our Values</Text>
            <Text style={styles.cardDesc}>
              Integrity, Innovation, Service Excellence, and Student-Centered Approach
              in everything we do.
            </Text>
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
  card: {
    backgroundColor: THEME.offWhite,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: '#EEF2FF',
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: '800',
    color: THEME.black,
    marginBottom: spacing.xs,
  },
  cardDesc: {
    fontSize: typography.sizes.sm,
    color: THEME.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
});