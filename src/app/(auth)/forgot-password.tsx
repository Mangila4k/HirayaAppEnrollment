import { supabase } from '@/lib/supabase/client';
import { spacing, typography } from '@/styles';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const THEME = {
  royalBlue: '#1E3A8A',
  yellow: '#F5C518',
  white: '#FFFFFF',
  offWhite: '#F5F7FA',
  lightGray: '#E5EAF2',
  gray: '#8A94A6',
  darkGray: '#4A5568',
  black: '#1A202C',
  danger: '#EF4444',
};

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'plsnhs://reset-password',
      });

      if (error) throw error;

      setSent(true);
      Alert.alert(
        'Reset Code Sent',
        'Please check your email for the password reset link.',
        [{ text: 'OK' }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="key" size={34} color={THEME.royalBlue} />
          </View>

          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a password reset code.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={THEME.gray} />
              <TextInput
                style={styles.input}
                placeholder="Enter your registered email"
                placeholderTextColor={THEME.gray}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!sent}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendReset}
            disabled={loading || sent}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={THEME.white} />
            ) : (
              <>
                <Ionicons name="paper-plane-outline" size={18} color={THEME.white} />
                <Text style={styles.sendButtonText}>
                  {sent ? 'Reset Code Sent' : 'Send Reset Code'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={16} color={THEME.royalBlue} />
            <Text style={styles.backLinkText}>Back to Login</Text>
          </TouchableOpacity>

          <View style={styles.features}>
            <View style={styles.feature}>
              <Ionicons name="time-outline" size={14} color={THEME.gray} />
              <Text style={styles.featureText}>Valid 1 hour</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="shield-checkmark-outline" size={14} color={THEME.gray} />
              <Text style={styles.featureText}>Secure</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="mail-outline" size={14} color={THEME.gray} />
              <Text style={styles.featureText}>Check inbox</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.royalBlue,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: THEME.white,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    backgroundColor: '#EEF2FF',
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: '800',
    color: THEME.black,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: THEME.gray,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  inputGroup: {
    width: '100%',
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: THEME.black,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: THEME.offWhite,
    borderWidth: 1,
    borderColor: THEME.lightGray,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.sm,
    color: THEME.black,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.royalBlue,
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
    width: '100%',
  },
  sendButtonText: {
    color: THEME.white,
    fontSize: typography.sizes.md,
    fontWeight: '800',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  backLinkText: {
    fontSize: typography.sizes.sm,
    color: THEME.royalBlue,
    fontWeight: '700',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: THEME.lightGray,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 10,
    color: THEME.gray,
    fontWeight: '500',
  },
});