import { spacing, typography } from '@/styles';
import { Ionicons } from '@expo/vector-icons';
import {
  ImageBackground,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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

export default function ContactPage() {
  const contacts = [
    { icon: 'location', title: 'Address', detail: 'Langtad, City of Naga, Cebu' },
    { icon: 'call', title: 'Phone', detail: '(032) 123-4567' },
    { icon: 'mail', title: 'Email', detail: 'info@plsnhs.edu.ph' },
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
            <Text style={styles.heroTitle}>Placido L. Señor NHS</Text>
            <Text style={styles.heroSubtitle}>Get in touch with us.</Text>
          </View>
        </ImageBackground>

        {/* ===== CONTACT CARDS ===== */}
        <View style={styles.body}>
          {contacts.map((c, i) => (
            <View key={i} style={styles.card}>
              <View style={styles.iconContainer}>
                <Ionicons name={c.icon as any} size={20} color={THEME.white} />
              </View>
              <View style={styles.content}>
                <Text style={styles.cardTitle}>{c.title}</Text>
                <Text style={styles.cardDetail}>{c.detail}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => Linking.openURL('https://www.google.com/maps/place/Placido+L.+Senor+National+High+School/@10.1878079,123.7329754,1079m/data=!3m2!1e3!4b1!4m6!3m5!1s0x33a9791164dd9e4f:0xc9874b0a854c1368!8m2!3d10.1878026!4d123.7355503!16s%2Fg%2F1hc8npbm1?entry=ttu&g_ep=EgoyMDI2MTAwNi4wIKXMDSoASAFQAw%3D%3D')}
            activeOpacity={0.85}
          >
            <Ionicons name="map" size={18} color={THEME.royalBlue} />
            <Text style={styles.mapButtonText}>View on Map</Text>
          </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.offWhite,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    backgroundColor: THEME.royalBlue,
  },
  content: { flex: 1 },
  cardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    color: THEME.gray,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  cardDetail: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: THEME.black,
    marginTop: 2,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.yellow,
    paddingVertical: spacing.md,
    borderRadius: 14,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  mapButtonText: {
    color: THEME.royalBlue,
    fontSize: typography.sizes.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});