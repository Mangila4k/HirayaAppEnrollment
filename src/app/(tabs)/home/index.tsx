import { supabase } from '@/lib/supabase/client';
import { spacing, typography } from '@/styles';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCHOOL_LOGO = require('../../../../assets/images/plsnhslogo.jpg');
const MATATAG_BG = require('@assets/images/matatag-bg.jpg');

const THEME = {
  royalBlue: '#1E3A8A',
  royalBlueLight: '#2D4BA8',
  royalBlueDark: '#152C6B',
  yellow: '#F5C518',
  white: '#FFFFFF',
  offWhite: '#F5F7FA',
  lightGray: '#E5EAF2',
  gray: '#8A94A6',
  darkGray: '#4A5568',
  black: '#1A202C',
  success: '#22C55E',
};

type Activity = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
};

export default function HomePage() {
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3); // Show only the 3 latest activities

      if (error) throw error;
      if (data) setActivities(data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  const FeatureCard = ({ icon, title, description }: any) => (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={26} color={THEME.royalBlue} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  );

  const StatItem = ({ number, label }: any) => (
    <View style={styles.statItem}>
      <Text style={styles.statNumber}>{number}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== NAVBAR ===== */}
        <View style={styles.navbar}>
          <View style={styles.brand}>
            <View style={styles.brandLogo}>
              <Image source={SCHOOL_LOGO} style={styles.brandLogoImage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.brandName} numberOfLines={1}>
                Placido L. Señor NHS
              </Text>
              <Text style={styles.brandSub} numberOfLines={1}>
                Enrollment System
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={16} color={THEME.royalBlue} />
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>

        {/* ===== HERO with MATATAG BACKGROUND ===== */}
        <ImageBackground
          source={MATATAG_BG}
          style={styles.heroSection}
          imageStyle={styles.heroImage}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              Welcome to <Text style={styles.heroHighlight}>PLSNHS</Text>
            </Text>
            <Text style={styles.heroSub}>
              Your seamless gateway to academic enrollment and management
            </Text>
            <TouchableOpacity
              style={styles.enrollButton}
              onPress={() => router.push('/(tabs)/enrollment')}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={20} color={THEME.royalBlue} />
              <Text style={styles.enrollButtonText}>Enroll Now</Text>
            </TouchableOpacity>
          </View>
        </ImageBackground>

        {/* ===== SCHOOL ACTIVITIES SECTION ===== */}
        <View style={styles.activitiesSection}>
          <Text style={styles.sectionTitle}>Latest Activities</Text>
          <Text style={styles.sectionSubTitle}>
            Explore recent events and achievements at PLSNHS.
          </Text>

          {loadingActivities ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={THEME.royalBlue} />
              <Text style={styles.loadingText}>Loading activities...</Text>
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="camera-outline" size={40} color={THEME.gray} />
              <Text style={styles.emptyText}>No school activities posted yet.</Text>
              <Text style={styles.emptySubText}>
                Check back soon for exciting updates!
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.activitiesScrollContent}
            >
              {activities.map((act) => (
                <View key={act.id} style={styles.activityCard}>
                  {/* Image Container with Text Overlay */}
                  <View style={styles.activityImageContainer}>
                    {/* object-fit: cover — fills the box like the web version */}
                    <Image
                      source={{ uri: act.image_url }}
                      style={styles.activityImage}
                      resizeMode="cover"
                    />

                    {/* Top-Right Text Overlay with dark gradient (simulated in RN) */}
                    <View style={styles.activityOverlay}>
                      <Text style={styles.activityTitleText} numberOfLines={2}>
                        {act.title}
                      </Text>
                    </View>

                    {/* Date Badge (Top Left) */}
                    <View style={styles.activityDateBadge}>
                      <Ionicons
                        name="calendar-outline"
                        size={11}
                        color={THEME.white}
                      />
                      <Text style={styles.activityDateText}>
                        {new Date(act.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Why Choose Placido L. Señor NHS?
          </Text>
          <View style={styles.featuresGrid}>
            <FeatureCard
              icon="document-text-outline"
              title="Easy Enrollment"
              description="Streamlined online enrollment process"
            />
            <FeatureCard
              icon="trending-up-outline"
              title="Real-time Tracking"
              description="Monitor enrollment status in real-time"
            />
            <FeatureCard
              icon="shield-checkmark-outline"
              title="Secure System"
              description="Your data is protected with industry-standard security"
            />
          </View>
        </View>

        {/* About */}
        <View style={styles.aboutSection}>
          <Text style={styles.sectionTitle}>About Us</Text>
          <Text style={styles.aboutText}>
            Placido L. Señor NHS Enrollment System is committed to providing
            quality education and a modern enrollment management system. We
            streamline the admission process, making it easier for students,
            parents, and administrators.
          </Text>
          <View style={styles.aboutList}>
            <View style={styles.aboutItem}>
              <Ionicons name="checkmark-circle" size={18} color={THEME.royalBlue} />
              <Text style={styles.aboutItemText}>Paperless enrollment process</Text>
            </View>
            <View style={styles.aboutItem}>
              <Ionicons name="checkmark-circle" size={18} color={THEME.royalBlue} />
              <Text style={styles.aboutItemText}>Automated status notifications</Text>
            </View>
            <View style={styles.aboutItem}>
              <Ionicons name="checkmark-circle" size={18} color={THEME.royalBlue} />
              <Text style={styles.aboutItemText}>Integrated document tracking</Text>
            </View>
            <View style={styles.aboutItem}>
              <Ionicons name="checkmark-circle" size={18} color={THEME.royalBlue} />
              <Text style={styles.aboutItemText}>24/7 accessibility</Text>
            </View>
          </View>

          <View style={styles.statsContainer}>
            <StatItem number="500+" label="Students Enrolled" />
            <StatItem number="50+" label="Staff Members" />
            <StatItem number="98%" label="Satisfaction Rate" />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 Placido L. Señor NHS Enrollment System. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.white },
  container: { flex: 1 },
  contentContainer: { paddingBottom: 0 },

  // ===== Navbar =====
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: THEME.royalBlue,
  },
  brand: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm },
  brandLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: THEME.white,
    borderWidth: 2,
    borderColor: THEME.yellow,
  },
  brandLogoImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  brandName: { fontSize: typography.sizes.sm, fontWeight: '700', color: THEME.white },
  brandSub: { fontSize: 11, color: THEME.yellow, fontWeight: '600' },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: THEME.yellow,
  },
  loginButtonText: {
    color: THEME.royalBlue,
    fontSize: typography.sizes.sm,
    fontWeight: '800',
  },

  // ===== Hero =====
  heroSection: {
    width: '100%',
    minHeight: 380,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,58,138,0.55)',
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
    fontSize: typography.sizes.hero,
    fontWeight: '800',
    color: THEME.white,
    textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroHighlight: { color: THEME.yellow },
  heroSub: {
    fontSize: typography.sizes.md,
    color: THEME.white,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
    opacity: 0.95,
    paddingHorizontal: spacing.md,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  enrollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.yellow,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 14,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  enrollButtonText: {
    color: THEME.royalBlue,
    fontSize: typography.sizes.md,
    fontWeight: '800',
  },

  // ===== Activities Section =====
  activitiesSection: {
    paddingVertical: spacing.xl,
    backgroundColor: THEME.offWhite,
    borderBottomWidth: 1,
    borderBottomColor: THEME.lightGray,
  },
  sectionSubTitle: {
    fontSize: typography.sizes.sm,
    color: THEME.gray,
    textAlign: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    color: THEME.gray,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.white,
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: THEME.gray,
    marginTop: spacing.sm,
  },
  emptySubText: {
    fontSize: 12,
    color: THEME.gray,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'center',
  },
  activitiesScrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  activityCard: {
    width: 300,
    backgroundColor: THEME.royalBlueDark,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.royalBlue + '40',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  activityImageContainer: {
    height: 220,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0d112d',
  },
  activityImage: {
    width: '100%',
    height: '100%',
  },
  activityOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: spacing.md,
    paddingLeft: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(13, 17, 50, 0.7)',
    borderBottomLeftRadius: 30,
    maxWidth: '80%',
  },
  activityTitleText: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.white,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    textAlign: 'right',
  },
  activityDateBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    zIndex: 2,
  },
  activityDateText: {
    color: THEME.white,
    fontSize: 11,
    fontWeight: '600',
  },

  // ===== Sections =====
  section: { padding: spacing.xl, backgroundColor: THEME.white },
  sectionTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '800',
    color: THEME.black,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // ===== Features =====
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  featureCard: {
    backgroundColor: THEME.offWhite,
    borderRadius: 16,
    padding: spacing.lg,
    width: '31.5%',
    minHeight: 160,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: '#EEF2FF',
  },
  featureTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    color: THEME.black,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 11,
    color: THEME.gray,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 15,
  },

  // ===== About =====
  aboutSection: {
    padding: spacing.xl,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 20,
    backgroundColor: THEME.offWhite,
    borderWidth: 1,
    borderColor: THEME.lightGray,
  },
  aboutText: {
    fontSize: typography.sizes.sm,
    color: THEME.darkGray,
    lineHeight: 22,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  aboutList: { gap: spacing.sm, marginTop: spacing.xs },
  aboutItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aboutItemText: {
    fontSize: typography.sizes.sm,
    color: THEME.black,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: THEME.lightGray,
  },
  statItem: { alignItems: 'center' },
  statNumber: {
    fontSize: typography.sizes.xxl,
    fontWeight: '800',
    color: THEME.royalBlue,
  },
  statLabel: {
    fontSize: 11,
    color: THEME.gray,
    marginTop: 4,
    textAlign: 'center',
  },

  // ===== Footer =====
  footer: {
    padding: spacing.lg,
    backgroundColor: THEME.royalBlue,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.sizes.xs,
    color: THEME.white,
    textAlign: 'center',
    opacity: 0.9,
  },
});