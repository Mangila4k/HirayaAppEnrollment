import { supabase } from '@/lib/supabase/client';
import { spacing, typography } from '@/styles';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Href, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import SchoolLogo from '@assets/images/plsnhslogo.jpg';

const MATATAG_BG = require('@assets/images/matatag-bg.jpg');

type UserRole = 'admin' | 'registrar' | 'teacher' | 'student' | 'parent';

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
  danger: '#EF4444',
};

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (!error && data?.user) {
        await AsyncStorage.setItem('userEmail', trimmedEmail);
        const role = data.user.user_metadata?.role || 'student';
        const validRoles: UserRole[] = ['admin', 'registrar', 'teacher', 'student', 'parent'];
        const validRole = validRoles.includes(role as UserRole) ? (role as UserRole) : 'student';
        router.replace(`/(dashboard)/${validRole}` as Href);
        setLoading(false);
        return;
      }

      const { data: userData, error: userError } = await supabase
        .from('users').select('*').eq('email', trimmedEmail).single();

      if (userError || !userData) {
        setErrorMessage('No account found with this email. Please enroll first.');
        setLoading(false);
        return;
      }

      if (userData.password !== trimmedPassword) {
        setErrorMessage('Invalid password. Please try again.');
        setLoading(false);
        return;
      }

      await AsyncStorage.setItem('userEmail', trimmedEmail);
      const role = userData.role || 'student';
      const validRoles: UserRole[] = ['admin', 'registrar', 'teacher', 'student', 'parent'];
      const validRole = validRoles.includes(role as UserRole) ? (role as UserRole) : 'student';
      router.replace(`/(dashboard)/${validRole}` as Href);
    } catch (error: any) {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={MATATAG_BG}
      style={styles.bgImage}
      imageStyle={styles.bgImageStyle}
      resizeMode="cover"
    >
      <View style={styles.bgOverlay} />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header banner (transparent) */}
          <View style={styles.headerBanner}>
            <View style={styles.schoolLogo}>
              <Image source={SchoolLogo} style={styles.schoolLogoImage} />
            </View>
            <Text style={styles.schoolNameTitle}>PLSNHS</Text>
            <Text style={styles.schoolNameSub}>
              Placido L. Señor NHS Enrollment System
            </Text>
          </View>

          {/* Login card */}
          <View style={styles.loginCard}>
            <Text style={styles.welcomeTitle}>Welcome Back</Text>
            <Text style={styles.welcomeSub}>Login to your account to continue</Text>

            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={THEME.danger} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color={THEME.gray} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email address"
                    placeholderTextColor={THEME.gray}
                    value={email}
                    onChangeText={(text) => { setEmail(text); setErrorMessage(''); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={18} color={THEME.gray} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={THEME.gray}
                    value={password}
                    onChangeText={(text) => { setPassword(text); setErrorMessage(''); }}
                    secureTextEntry={!showPassword}
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={THEME.gray}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.rowBetween}>
                <TouchableOpacity
                  style={styles.rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Ionicons name="checkmark" size={12} color={THEME.white} />}
                  </View>
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={THEME.white} />
                ) : (
                  <Text style={styles.loginButtonText}>Login</Text>
                )}
              </TouchableOpacity>

              <View style={styles.signupLink}>
                <Text style={styles.signupText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/enrollment')}>
                  <Text style={styles.signupLinkText}>Enroll Now</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.backHome}
                onPress={() => router.push('/(tabs)/home')}
              >
                <Ionicons name="arrow-back" size={14} color={THEME.gray} />
                <Text style={styles.backHomeText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: { flex: 1, width: '100%', height: '100%' },
  bgImageStyle: {},
  bgOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30,58,138,0.75)', // Royal blue tint over banner
  },

  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  // Header banner (over background)
  headerBanner: { alignItems: 'center', marginBottom: spacing.xl },
  schoolLogo: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: THEME.white,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 3, borderColor: THEME.yellow,
    overflow: 'hidden',
  },
  schoolLogoImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  schoolNameTitle: {
    fontSize: 28, fontWeight: '800', color: THEME.white, letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  schoolNameSub: {
    fontSize: 12, color: THEME.yellow, marginTop: 4,
    fontWeight: '600', textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Login card (white, flat)
  loginCard: {
    backgroundColor: THEME.white,
    borderRadius: 20,
    padding: spacing.xl,
  },
  welcomeTitle: {
    fontSize: typography.sizes.xxl, fontWeight: '800',
    color: THEME.black, marginBottom: spacing.xs, textAlign: 'center',
  },
  welcomeSub: {
    fontSize: typography.sizes.sm, color: THEME.gray,
    marginBottom: spacing.lg, textAlign: 'center',
  },

  errorContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, padding: spacing.md, marginBottom: spacing.md,
    gap: spacing.sm, backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: {
    flex: 1, fontSize: typography.sizes.sm,
    color: THEME.danger, fontWeight: '600',
  },

  form: { gap: spacing.md },
  inputGroup: { gap: spacing.xs },
  label: { fontSize: typography.sizes.sm, fontWeight: '600', color: THEME.black },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, paddingHorizontal: spacing.md,
    backgroundColor: THEME.offWhite,
    borderWidth: 1, borderColor: THEME.lightGray,
    gap: spacing.sm,
  },
  input: {
    flex: 1, paddingVertical: spacing.md,
    fontSize: typography.sizes.sm, color: THEME.black,
  },

  rowBetween: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  rememberMe: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: THEME.royalBlue,
    backgroundColor: THEME.white,
  },
  checkboxChecked: { backgroundColor: THEME.royalBlue },
  rememberMeText: { fontSize: typography.sizes.sm, color: THEME.darkGray },
  forgotPasswordText: {
    fontSize: typography.sizes.sm, color: THEME.royalBlue, fontWeight: '700',
  },

  loginButton: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: THEME.royalBlue,
    paddingVertical: spacing.md, borderRadius: 12, marginTop: spacing.xs,
  },
  loginButtonText: {
    color: THEME.white, fontSize: typography.sizes.md,
    fontWeight: '800', letterSpacing: 0.5,
  },

  signupLink: {
    flexDirection: 'row', justifyContent: 'center',
    flexWrap: 'wrap', marginTop: spacing.sm,
  },
  signupText: { fontSize: typography.sizes.sm, color: THEME.gray },
  signupLinkText: {
    fontSize: typography.sizes.sm, color: THEME.royalBlue, fontWeight: '700',
  },

  backHome: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, marginTop: spacing.sm,
  },
  backHomeText: {
    fontSize: typography.sizes.sm, color: THEME.gray, fontWeight: '500',
  },
});