import TeacherSidebar from '@/components/TeacherSidebar';
import { supabase } from '@/lib/supabase/client';
import { compareFaceTokens, getFaceTokenFromBase64 } from '@/lib/utils/faceFingerprint';
import { colors, spacing, typography } from '@/styles';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ============================================
// TIME CONSTANTS
// ============================================
const TIME_IN_CUTOFF_HOUR = 8;
const TIME_OUT_START_HOUR = 17;
const TIME_OUT_END_HOUR = 8;

// ============================================
// PHILIPPINE TIME HELPERS (UTC+8)
// ============================================
const PHT_OFFSET_HOURS = 8;

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

const getPHTDate = (d: Date = new Date()): Date => {
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + PHT_OFFSET_HOURS * 3600000);
};

const getPHTDateString = (d: Date = new Date()): string => {
  const pht = getPHTDate(d);
  const y = pht.getFullYear();
  const m = String(pht.getMonth() + 1).padStart(2, '0');
  const day = String(pht.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatPHTTime = (input: Date | string | null): string => {
  if (!input) return '--:--';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '--:--';

  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const pht = new Date(utc + PHT_OFFSET_HOURS * 3600000);

  let h = pht.getHours();
  const m = String(pht.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

const formatPHTDate = (input: string | Date): string => {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '--';

  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const pht = new Date(utc + PHT_OFFSET_HOURS * 3600000);

  return pht.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const formatPHTLongDate = (input: string | Date): string => {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '--';

  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const pht = new Date(utc + PHT_OFFSET_HOURS * 3600000);

  return pht.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

// ============================================
// TYPES
// ============================================
type TeacherAttendance = {
  id?: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  in_status: string | null;
  out_status: string | null;
};

export default function FaceAttendance() {
  const router = useRouter();
  const theme = { background: NEU.bg, card: NEU.bg, cardBorder: NEU.bgDark, text: NEU.text, textMuted: NEU.textMuted };
const primaryColor = NEU.accent;
  const cameraRef = useRef<any>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [showSidebar, setShowSidebar] = useState(false);
  const [checking, setChecking] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherFaceToken, setTeacherFaceToken] = useState<string | null>(null);
  const [lastSimilarity, setLastSimilarity] = useState<number | null>(null);
  const [action, setAction] = useState<'in' | 'out' | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TeacherAttendance | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<TeacherAttendance[]>([]);

  useEffect(() => {
    checkRegistration();
  }, []);

  const checkRegistration = async () => {
    setChecking(true);
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        setChecking(false);
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      if (!userData) {
        setChecking(false);
        return;
      }

      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('user_id', userData.id)
        .maybeSingle();
      if (!teacherData) {
        setChecking(false);
        return;
      }

      setTeacherId(teacherData.id);

      const { data: faceData } = await supabase
        .from('teacher_faces')
        .select('face_fingerprint')
        .eq('teacher_id', teacherData.id)
        .maybeSingle();

      if (faceData?.face_fingerprint) {
        setTeacherFaceToken(faceData.face_fingerprint);
      }

      const today = getPHTDateString();
      const { data: todayData } = await supabase
        .from('teacher_attendance')
        .select('*')
        .eq('teacher_id', teacherData.id)
        .eq('date', today)
        .maybeSingle();

      setTodayAttendance(todayData || null);

      const { data: recent } = await supabase
        .from('teacher_attendance')
        .select('*')
        .eq('teacher_id', teacherData.id)
        .order('date', { ascending: false })
        .limit(7);

      setRecentAttendance(recent || []);
    } catch (e) {
      console.error(e);
    } finally {
      setChecking(false);
    }
  };

  const verifyFace = async (mode: 'in' | 'out') => {
    if (!cameraRef.current || !teacherFaceToken || !teacherId) return;
    setAction(mode);
    setVerifying(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 0.7,
        skipProcessing: false,
        exif: false,
      });

      if (!photo?.uri) throw new Error('Failed to capture');

      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 480 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!resized.base64) throw new Error('Resize failed');

      const newToken = await getFaceTokenFromBase64(resized.base64);

      if (!newToken) {
        Alert.alert(
          'No Face Detected',
          'Face++ could not detect a face. Please ensure good lighting and look directly at the camera.'
        );
        return;
      }

      const confidence = await compareFaceTokens(newToken, teacherFaceToken);

      if (confidence === null) {
        Alert.alert('Verification Error', 'Face++ comparison failed. Please try again.');
        return;
      }

      setLastSimilarity(confidence);

      if (confidence < 80) {
        Alert.alert(
          'Face Did Not Match',
          `Confidence: ${confidence.toFixed(1)}% (need 80%+)\n\nThis is not the registered face.`
        );
        return;
      }

      if (mode === 'in') {
        await recordTimeIn();
      } else {
        await recordTimeOut();
      }
    } catch (e: any) {
      Alert.alert('Capture Failed', e.message);
    } finally {
      setVerifying(false);
      setAction(null);
    }
  };

  const recordTimeIn = async () => {
    if (!teacherId) return;

    if (todayAttendance?.time_in) {
      Alert.alert(
        'Already Timed In',
        `You already recorded your Time In at ${formatPHTTime(
          todayAttendance.time_in
        )} today.`
      );
      return;
    }

    const now = new Date();
    const pht = getPHTDate(now);
    const today = getPHTDateString(now);

    const hour = pht.getHours();
    const minute = pht.getMinutes();
    const isLate =
      hour > TIME_IN_CUTOFF_HOUR || (hour === TIME_IN_CUTOFF_HOUR && minute > 0);
    const status = isLate ? 'Late' : 'Present';

    const { data, error } = await supabase
      .from('teacher_attendance')
      .upsert(
        {
          teacher_id: teacherId,
          date: today,
          time_in: now.toISOString(),
          in_status: status,
        },
        { onConflict: 'teacher_id,date' }
      )
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setTodayAttendance(data);
    setVerified(true);

    Alert.alert(
      'Time In Recorded',
      `Status: ${status}\nTime: ${formatPHTTime(now)} (PHT)\nFace++ Confidence: ${lastSimilarity?.toFixed(1)}%\n\n${
        isLate ? '⚠️ You are late (after 8:00 AM).' : '✅ You are on time!'
      }`,
      [{ text: 'OK' }]
    );
  };

  const recordTimeOut = async () => {
    if (!teacherId || !todayAttendance) return;

    if (todayAttendance.time_out) {
      Alert.alert(
        'Already Timed Out',
        `You already recorded your Time Out at ${formatPHTTime(
          todayAttendance.time_out
        )} today.`
      );
      return;
    }

    const now = new Date();
    const pht = getPHTDate(now);
    const hour = pht.getHours();

    const isEveningWindow = hour >= TIME_OUT_START_HOUR;
    const isMorningWindow = hour < TIME_OUT_END_HOUR;
    const isAllowed = isEveningWindow || isMorningWindow;

    if (!isAllowed) {
      Alert.alert(
        'Time Out Not Allowed Now',
        `It is currently ${formatPHTTime(now)} (PHT).\n\nTime Out is only allowed:\n• 5:00 PM – 11:59 PM\n• 12:00 AM – 7:59 AM`,
        [{ text: 'OK' }]
      );
      return;
    }

    const status = isEveningWindow ? 'Completed' : 'Overnight Out';

    const { data, error } = await supabase
      .from('teacher_attendance')
      .update({
        time_out: now.toISOString(),
        out_status: status,
      })
      .eq('teacher_id', teacherId)
      .eq('date', todayAttendance.date)
      .select()
      .single();

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setTodayAttendance(data);
    setVerified(true);

    Alert.alert(
      'Time Out Recorded',
      `Status: ${status}\nTime: ${formatPHTTime(now)} (PHT)`,
      [{ text: 'OK' }]
    );
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'Present':
        return '#4CAF50';
      case 'Late':
        return '#FF9800';
      case 'Completed':
        return '#4CAF50';
      case 'Overnight Out':
        return '#2196F3';
      case 'Early Out':
        return '#F44336';
      default:
        return '#999';
    }
  };

  // Loading permission
  if (!permission) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      </SafeAreaView>
    );
  }

  // Permission not granted
  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={60} color={theme.textMuted} />
          <Text style={[styles.permissionText, { color: theme.textMuted }]}>
            Camera permission required
          </Text>
          <TouchableOpacity
            style={[styles.grantBtn, { backgroundColor: primaryColor }]}
            onPress={requestPermission}
          >
            <Text style={styles.grantBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Checking
  if (checking) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            Checking registration...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Face not registered
  if (!teacherFaceToken) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={60} color="#FF9800" />
          <Text style={[styles.errorTitle, { color: theme.text }]}>Face Not Registered</Text>
          <Text style={[styles.errorText, { color: theme.textMuted }]}>
            Ask the admin to register your face first.
          </Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: primaryColor }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hasTimedIn = !!todayAttendance?.time_in;
  const hasTimedOut = !!todayAttendance?.time_out;
  const isDayComplete = hasTimedIn && hasTimedOut;
  const canTimeIn = !hasTimedIn;
  const canTimeOut = hasTimedIn && !hasTimedOut;

  // ============ DAY COMPLETE SCREEN ============
  if (isDayComplete && !verified) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setShowSidebar(true)}
              style={[
                styles.menuButton,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="menu" size={22} color={primaryColor} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>My Attendance</Text>
            <View style={{ width: 42 }} />
          </View>

          <View
            style={[
              styles.completeCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Ionicons name="checkmark-done-circle" size={70} color="#4CAF50" />
            <Text style={styles.completeTitle}>Attendance Complete!</Text>
            <Text style={[styles.completeText, { color: theme.textMuted }]}>
              You have already timed in and out today.
            </Text>
          </View>

          {todayAttendance ? (
            <View
              style={[
                styles.todayCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.todayTitle, { color: theme.text }]}>Today's Record</Text>
              <Text style={[styles.todayDate, { color: theme.textMuted }]}>
                {formatPHTLongDate(todayAttendance.date)}
              </Text>

              <View style={styles.todayRow}>
                <View style={styles.todayCol}>
                  <Ionicons name="log-in" size={22} color="#4CAF50" />
                  <Text style={[styles.todayLabel, { color: theme.textMuted }]}>
                    Time In
                  </Text>
                  <Text style={[styles.todayTime, { color: theme.text }]}>
                    {formatPHTTime(todayAttendance.time_in)}
                  </Text>
                  {todayAttendance.in_status ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: getStatusColor(todayAttendance.in_status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: getStatusColor(todayAttendance.in_status) },
                        ]}
                      >
                        {todayAttendance.in_status}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={[styles.todayDivider, { backgroundColor: theme.cardBorder }]} />
                <View style={styles.todayCol}>
                  <Ionicons name="log-out" size={22} color="#F44336" />
                  <Text style={[styles.todayLabel, { color: theme.textMuted }]}>
                    Time Out
                  </Text>
                  <Text style={[styles.todayTime, { color: theme.text }]}>
                    {formatPHTTime(todayAttendance.time_out)}
                  </Text>
                  {todayAttendance.out_status ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: getStatusColor(todayAttendance.out_status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: getStatusColor(todayAttendance.out_status) },
                        ]}
                      >
                        {todayAttendance.out_status}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={[styles.lockedNote, { borderTopColor: theme.cardBorder }]}>
                <Ionicons name="lock-closed" size={14} color={theme.textMuted} />
                <Text style={[styles.lockedText, { color: theme.textMuted }]}>
                  Attendance for today is locked (Philippine Time)
                </Text>
              </View>
            </View>
          ) : null}

          {recentAttendance.length > 0 ? (
            <View style={styles.historySection}>
              <Text style={[styles.historyTitle, { color: theme.text }]}>
                <Ionicons name="time" size={18} color={primaryColor} /> Recent Attendance
              </Text>
              {recentAttendance.map((a) => (
                <View
                  key={a.date}
                  style={[
                    styles.historyItem,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.historyDateCol}>
                    <Text style={[styles.historyDate, { color: theme.text }]}>
                      {formatPHTDate(a.date)}
                    </Text>
                  </View>
                  <View style={styles.historyTimesCol}>
                    <Text style={[styles.historyTime, { color: theme.textMuted }]}>
                      In: {formatPHTTime(a.time_in)}
                    </Text>
                    <Text style={[styles.historyTime, { color: theme.textMuted }]}>
                      Out: {formatPHTTime(a.time_out)}
                    </Text>
                  </View>
                  <View style={styles.historyStatusCol}>
                    {a.in_status ? (
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: getStatusColor(a.in_status) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            { color: getStatusColor(a.in_status) },
                          ]}
                        >
                          {a.in_status}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => router.back()}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Done</Text>
          </TouchableOpacity>
        </ScrollView>

        <TeacherSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
      </SafeAreaView>
    );
  }

  // ============ VERIFIED SCREEN ============
  if (verified) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setShowSidebar(true)}
              style={[
                styles.menuButton,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="menu" size={22} color={primaryColor} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.text }]}>Attendance</Text>
            <View style={{ width: 42 }} />
          </View>

          <View
            style={[
              styles.successCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <Ionicons name="checkmark-circle" size={70} color="#4CAF50" />
            <Text style={[styles.successTitle, { color: theme.text }]}>Recorded!</Text>
            <Text style={[styles.successText, { color: theme.textMuted }]}>
              Face++ Confidence: {lastSimilarity?.toFixed(1)}%
            </Text>
          </View>

          {todayAttendance ? (
            <View
              style={[
                styles.todayCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.todayTitle, { color: theme.text }]}>
                Today's Attendance
              </Text>
              <View style={styles.todayRow}>
                <View style={styles.todayCol}>
                  <Ionicons name="log-in" size={22} color="#4CAF50" />
                  <Text style={[styles.todayLabel, { color: theme.textMuted }]}>
                    Time In
                  </Text>
                  <Text style={[styles.todayTime, { color: theme.text }]}>
                    {formatPHTTime(todayAttendance.time_in)}
                  </Text>
                </View>
                <View style={[styles.todayDivider, { backgroundColor: theme.cardBorder }]} />
                <View style={styles.todayCol}>
                  <Ionicons name="log-out" size={22} color="#F44336" />
                  <Text style={[styles.todayLabel, { color: theme.textMuted }]}>
                    Time Out
                  </Text>
                  <Text style={[styles.todayTime, { color: theme.text }]}>
                    {formatPHTTime(todayAttendance.time_out)}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: primaryColor }]}
            onPress={() => {
              setVerified(false);
              checkRegistration();
            }}
          >
            <Ionicons name="scan" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
            onPress={() => router.back()}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.text }]}>Done</Text>
          </TouchableOpacity>
        </ScrollView>

        <TeacherSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
      </SafeAreaView>
    );
  }

  // ============ MAIN SCREEN ============
  const phtNow = getPHTDate(new Date());

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setShowSidebar(true)}
            style={[
              styles.menuButton,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons name="menu" size={22} color={primaryColor} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>My Attendance</Text>
          <TouchableOpacity onPress={checkRegistration} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color={primaryColor} />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.statusCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={[styles.statusHeader, { borderBottomColor: theme.cardBorder }]}>
            <Ionicons name="calendar" size={20} color={primaryColor} />
            <Text style={[styles.statusCardTitle, { color: theme.text }]}>
              {phtNow.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              (PHT)
            </Text>
          </View>

          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Ionicons name="log-in" size={22} color="#4CAF50" />
              <Text style={[styles.statusLabel, { color: theme.textMuted }]}>Time In</Text>
              <Text style={[styles.statusValue, { color: theme.text }]}>
                {todayAttendance?.time_in ? formatPHTTime(todayAttendance.time_in) : '--:--'}
              </Text>
              {todayAttendance?.in_status ? (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: getStatusColor(todayAttendance.in_status) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: getStatusColor(todayAttendance.in_status) },
                    ]}
                  >
                    {todayAttendance.in_status}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.statusPending, { color: theme.textMuted }]}>
                  Pending
                </Text>
              )}
            </View>

            <View style={styles.statusItem}>
              <Ionicons name="log-out" size={22} color="#F44336" />
              <Text style={[styles.statusLabel, { color: theme.textMuted }]}>Time Out</Text>
              <Text style={[styles.statusValue, { color: theme.text }]}>
                {todayAttendance?.time_out
                  ? formatPHTTime(todayAttendance.time_out)
                  : '--:--'}
              </Text>
              {todayAttendance?.out_status ? (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: getStatusColor(todayAttendance.out_status) + '20' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: getStatusColor(todayAttendance.out_status) },
                    ]}
                  >
                    {todayAttendance.out_status}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.statusPending, { color: theme.textMuted }]}>
                  Pending
                </Text>
              )}
            </View>
          </View>
        </View>

        <View
          style={[
            styles.rulesCard,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <View style={styles.rulesHeader}>
            <Ionicons name="information-circle" size={18} color={primaryColor} />
            <Text style={[styles.rulesTitle, { color: theme.text }]}>
              Attendance Rules (PHT)
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <View style={[styles.ruleDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={[styles.ruleText, { color: theme.textMuted }]}>
              <Text style={[styles.ruleBold, { color: theme.text }]}>
                Time In before 8:00 AM
              </Text>{' '}
              → Present
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <View style={[styles.ruleDot, { backgroundColor: '#FF9800' }]} />
            <Text style={[styles.ruleText, { color: theme.textMuted }]}>
              <Text style={[styles.ruleBold, { color: theme.text }]}>
                Time In after 8:00 AM
              </Text>{' '}
              → Late
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <View style={[styles.ruleDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={[styles.ruleText, { color: theme.textMuted }]}>
              <Text style={[styles.ruleBold, { color: theme.text }]}>
                Time Out 5:00 PM – 11:59 PM
              </Text>{' '}
              → Completed
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <View style={[styles.ruleDot, { backgroundColor: '#2196F3' }]} />
            <Text style={[styles.ruleText, { color: theme.textMuted }]}>
              <Text style={[styles.ruleBold, { color: theme.text }]}>
                Time Out 12:00 AM – 7:59 AM
              </Text>{' '}
              → Overnight Out
            </Text>
          </View>
          <View style={styles.ruleRow}>
            <View style={[styles.ruleDot, { backgroundColor: '#F44336' }]} />
            <Text style={[styles.ruleText, { color: theme.textMuted }]}>
              <Text style={[styles.ruleBold, { color: theme.text }]}>
                Time Out 8:00 AM – 4:59 PM
              </Text>{' '}
              → Not allowed
            </Text>
          </View>
        </View>

        <View style={styles.cameraContainer}>
          <CameraView ref={cameraRef} style={styles.camera} facing="front" />
          <View style={[styles.faceFrame, { borderColor: primaryColor }]} />
          <View style={styles.faceHint}>
            <Ionicons name="person-circle-outline" size={14} color="#fff" />
            <Text style={styles.faceHintText}>Position your face inside the frame</Text>
          </View>
        </View>

        {lastSimilarity !== null ? (
          <Text style={[styles.similarityText, { color: theme.textMuted }]}>
            Last confidence: {lastSimilarity.toFixed(1)}%
          </Text>
        ) : null}

        {hasTimedIn && hasTimedOut ? (
          <View style={[styles.lockedBanner, { borderColor: '#4CAF5040' }]}>
            <Ionicons name="lock-closed" size={20} color="#4CAF50" />
            <Text style={styles.lockedBannerText}>
              Day complete — attendance locked for today
            </Text>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: canTimeIn ? '#4CAF50' : '#ccc' }]}
              onPress={() => verifyFace('in')}
              disabled={!canTimeIn || verifying}
            >
              {verifying && action === 'in' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={canTimeIn ? 'log-in' : 'lock-closed'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.actionBtnText}>
                    {canTimeIn ? 'Time In' : 'Timed In'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: canTimeOut ? '#F44336' : '#ccc' }]}
              onPress={() => verifyFace('out')}
              disabled={!canTimeOut || verifying}
            >
              {verifying && action === 'out' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons
                    name={canTimeOut ? 'log-out' : 'lock-closed'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.actionBtnText}>
                    {canTimeOut ? 'Time Out' : hasTimedOut ? 'Timed Out' : 'Locked'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {recentAttendance.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={[styles.historyTitle, { color: theme.text }]}>
              <Ionicons name="time" size={18} color={primaryColor} /> Recent Attendance
            </Text>
            {recentAttendance.map((a) => (
              <View
                key={a.date}
                style={[
                  styles.historyItem,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <View style={styles.historyDateCol}>
                  <Text style={[styles.historyDate, { color: theme.text }]}>
                    {formatPHTDate(a.date)}
                  </Text>
                </View>
                <View style={styles.historyTimesCol}>
                  <Text style={[styles.historyTime, { color: theme.textMuted }]}>
                    In: {formatPHTTime(a.time_in)}
                  </Text>
                  <Text style={[styles.historyTime, { color: theme.textMuted }]}>
                    Out: {formatPHTTime(a.time_out)}
                  </Text>
                </View>
                <View style={styles.historyStatusCol}>
                  {a.in_status ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: getStatusColor(a.in_status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: getStatusColor(a.in_status) },
                        ]}
                      >
                        {a.in_status}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <TeacherSidebar visible={showSidebar} onClose={() => setShowSidebar(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, padding: spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  loadingText: { marginTop: spacing.md, fontSize: typography.sizes.md },
  permissionText: {
    fontSize: typography.sizes.md,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  grantBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 10,
  },
  grantBtnText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  backBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 10,
  },
  backBtnText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingTop: spacing.md,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  refreshButton: { padding: spacing.sm },
  title: { fontSize: typography.sizes.xl, fontWeight: '700' },

  completeCard: {
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  completeTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    color: '#4CAF50',
    marginTop: spacing.md,
  },
  completeText: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  statusCard: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  statusCardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  statusGrid: { flexDirection: 'row' },
  statusItem: { flex: 1, alignItems: 'center', gap: 4 },
  statusLabel: { fontSize: typography.sizes.xs },
  statusValue: { fontSize: typography.sizes.md, fontWeight: '700' },
  statusPending: { fontSize: typography.sizes.xs, fontStyle: 'italic' },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  statusPillText: { fontSize: typography.sizes.xs, fontWeight: '500' },

  rulesCard: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rulesTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  ruleDot: { width: 8, height: 8, borderRadius: 4 },
  ruleText: { flex: 1, fontSize: typography.sizes.xs },
  ruleBold: { fontWeight: '600' },

  cameraContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  faceFrame: {
    position: 'absolute',
    top: '20%',
    left: '22%',
    width: '56%',
    height: '60%',
    borderWidth: 2,
    borderRadius: 20,
    borderStyle: 'dashed',
  },
  faceHint: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  faceHintText: { color: '#fff', fontSize: typography.sizes.xs },
  similarityText: {
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 10,
    gap: spacing.sm,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#4CAF5020',
    padding: spacing.md,
    borderRadius: 10,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  lockedBannerText: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: '#4CAF50',
  },
  lockedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  lockedText: { fontSize: typography.sizes.xs },

  successCard: {
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  successTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  successText: { fontSize: typography.sizes.sm, marginTop: spacing.xs },

  todayCard: {
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  todayTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  todayDate: {
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  todayRow: { flexDirection: 'row', alignItems: 'center' },
  todayCol: { flex: 1, alignItems: 'center', gap: 4 },
  todayDivider: { width: 1, height: 80 },
  todayLabel: { fontSize: typography.sizes.xs },
  todayTime: { fontSize: typography.sizes.md, fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 10,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  secondaryBtnText: { fontSize: typography.sizes.md, fontWeight: '500' },

  historySection: { marginTop: spacing.md, marginBottom: spacing.lg },
  historyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
  },
  historyDateCol: { flex: 1.2 },
  historyDate: { fontSize: typography.sizes.sm, fontWeight: '500' },
  historyTimesCol: { flex: 1.3 },
  historyTime: { fontSize: typography.sizes.xs },
  historyStatusCol: { flex: 1, alignItems: 'flex-end' },
});