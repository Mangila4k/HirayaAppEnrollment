import { supabase } from '@/lib/supabase/client';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MATATAG_BG = require('@assets/images/matatag-bg.jpg');

const THEME = {
  royalBlue: '#1E3A8A',
  royalBlueDark: '#152C6B',
  yellow: '#F5C518',
  white: '#FFFFFF',
  offWhite: '#F0F4FA',
  offWhiteDark: '#D6E0F0',
  gray: '#8A94A6',
  darkGray: '#4A5568',
  black: '#1A202C',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};

// ============================================================
// ENROLLMENT WINDOW KEY
// ============================================================
const ENROLLMENT_KEY = 'enrollment_open';

// ============================================================
// ENROLLMENT WINDOW HOOK (Supabase-backed + Realtime)
// ============================================================
type EnrollmentWindowState = {
  isOpen: boolean;
  loading: boolean;
  lastChecked: number;
};

function useEnrollmentWindow() {
  const [state, setState] = useState<EnrollmentWindowState>({
    isOpen: true,
    loading: true,
    lastChecked: 0,
  });

  const checkWindow = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', ENROLLMENT_KEY)
        .maybeSingle();

      if (error) throw error;
      const isOpen = data ? data.value === 'true' : true;
      setState({ isOpen, loading: false, lastChecked: Date.now() });
      return isOpen;
    } catch (e) {
      console.warn('Enrollment window read failed, assuming OPEN:', e);
      setState(s => ({ ...s, isOpen: true, loading: false, lastChecked: Date.now() }));
      return true;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    checkWindow();

    const channel = supabase
      .channel('enrollment-window-mobile')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${ENROLLMENT_KEY}` },
        (payload) => {
          if (cancelled) return;
          const value = (payload.new as any)?.value;
          const isOpen = value === 'true';
          setState({ isOpen, loading: false, lastChecked: Date.now() });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [checkWindow]);

  return { ...state, recheck: checkWindow };
}

type RequirementDef = { field: string; name: string; required: boolean; accept: string };

type FormState = {
  firstName: string; lastName: string; middleName: string; suffix: string;
  email: string; dob: string; age: string;
  birthplace: string; gender: string; nationality: string; religion: string; address: string;
  motherName: string; motherOccupation: string;
  fatherName: string; fatherOccupation: string;
  guardian: string; guardianRelationship: string; guardianContact: string;
  guardianEmail: string; guardianAddress: string;
  gradeLevel: string; studentType: string; strand: string;
  tvlSpecialization: string; schoolYear: string;
};

// ============================================================
// REQUIREMENTS
// ============================================================
const REQUIREMENTS: Record<string, Record<string, RequirementDef[]>> = {
  'Grade 7': {
    new: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'form_137', name: 'Form 137 (Permanent Record)', required: true, accept: 'application/pdf,image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
      { field: 'certificate_of_completion', name: 'Certificate of Completion (Elementary)', required: true, accept: 'application/pdf,image/*' },
      { field: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, accept: 'application/pdf,image/*' },
      { field: 'good_moral_cert', name: 'Good Moral Certificate', required: true, accept: 'application/pdf,image/*' },
    ],
    transferee: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'form_137', name: 'Form 137 (Permanent Record)', required: true, accept: 'application/pdf,image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
      { field: 'certificate_of_completion', name: 'Certificate of Completion (Elementary)', required: true, accept: 'application/pdf,image/*' },
      { field: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, accept: 'application/pdf,image/*' },
      { field: 'good_moral_cert', name: 'Good Moral Certificate', required: true, accept: 'application/pdf,image/*' },
    ],
  },
  'Grade 8': {
    continuing: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
    ],
    transferee: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'form_137', name: 'Form 137 (Permanent Record)', required: true, accept: 'application/pdf,image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
      { field: 'certificate_of_completion', name: 'Certificate of Completion', required: true, accept: 'application/pdf,image/*' },
      { field: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, accept: 'application/pdf,image/*' },
      { field: 'good_moral_cert', name: 'Good Moral Certificate', required: true, accept: 'application/pdf,image/*' },
    ],
  },
  'Grade 9': {
    continuing: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
    ],
    transferee: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'form_137', name: 'Form 137 (Permanent Record)', required: true, accept: 'application/pdf,image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
      { field: 'certificate_of_completion', name: 'Certificate of Completion', required: true, accept: 'application/pdf,image/*' },
      { field: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, accept: 'application/pdf,image/*' },
      { field: 'good_moral_cert', name: 'Good Moral Certificate', required: true, accept: 'application/pdf,image/*' },
    ],
  },
  'Grade 10': {
    continuing: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
    ],
    transferee: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'form_137', name: 'Form 137 (Permanent Record)', required: true, accept: 'application/pdf,image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
      { field: 'certificate_of_completion', name: 'Certificate of Completion', required: true, accept: 'application/pdf,image/*' },
      { field: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, accept: 'application/pdf,image/*' },
      { field: 'good_moral_cert', name: 'Good Moral Certificate', required: true, accept: 'application/pdf,image/*' },
    ],
  },
  'Grade 11': {
    same_school: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
    ],
    different_school: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'form_137', name: 'Form 137 (Permanent Record)', required: true, accept: 'application/pdf,image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
      { field: 'certificate_of_completion', name: 'Certificate of Completion (Junior High)', required: true, accept: 'application/pdf,image/*' },
      { field: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, accept: 'application/pdf,image/*' },
      { field: 'good_moral_cert', name: 'Good Moral Certificate', required: true, accept: 'application/pdf,image/*' },
    ],
  },
  'Grade 12': {
    continuing: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
    ],
    transferee: [
      { field: 'two_by_two_picture', name: '2x2 ID Picture (White Background)', required: true, accept: 'image/*' },
      { field: 'form_137', name: 'Form 137 (Permanent Record)', required: true, accept: 'application/pdf,image/*' },
      { field: 'report_card', name: 'Report Card', required: true, accept: 'application/pdf,image/*' },
      { field: 'certificate_of_completion', name: 'Certificate of Completion', required: true, accept: 'application/pdf,image/*' },
      { field: 'psa_birth_cert', name: 'PSA Birth Certificate', required: true, accept: 'application/pdf,image/*' },
      { field: 'good_moral_cert', name: 'Good Moral Certificate', required: true, accept: 'application/pdf,image/*' },
    ],
  },
};

const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];

const STUDENT_TYPE_OPTIONS: Record<string, Record<string, string>> = {
  'Grade 7': { new: 'New Student (From Elementary)', transferee: 'Transferee (From another school)' },
  'Grade 8': { continuing: 'Continuing Student', transferee: 'Transferee (From another school)' },
  'Grade 9': { continuing: 'Continuing Student', transferee: 'Transferee (From another school)' },
  'Grade 10': { continuing: 'Continuing Student', transferee: 'Transferee (From another school)' },
  'Grade 11': { same_school: 'From PLSNHS', different_school: 'From a different school (Transferee)' },
  'Grade 12': { continuing: 'Continuing Student (From Grade 11)', transferee: 'Transferee (From another school)' },
};

const STRANDS = ['TVL', 'HUMSS', 'GAS', 'STEM'];
const TVL_SPECS = ['TVL-Cookery', 'TVL-ICT'];

// Validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const PHONE_RE = /^(09\d{9}|\+639\d{9})$/;
const NAME_RE = /^[A-Za-zÀ-ÿ.'\-\s]+$/;
const SCHOOL_YEAR_RE = /^\d{4}-\d{4}$/;

function calcAgeFromDate(date: Date): string {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const md = today.getMonth() - date.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < date.getDate())) age--;
  if (age < 0 || age > 120) return '';
  return String(age);
}
function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatPretty(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ============================================================
// MEMOIZED TEXT FIELD
// ============================================================
type FieldProps = TextInputProps & {
  field: string;
  hasError?: boolean;
  onChangeText: (text: string) => void;
};

const TextField = React.memo(
  ({ field, hasError, style, onChangeText, ...props }: FieldProps) => {
    return (
      <TextInput
        {...props}
        style={[styles.input, hasError && styles.inputError, style]}
        onChangeText={onChangeText}
      />
    );
  }
);
TextField.displayName = 'TextField';

// ============================================================
// MAIN SCREEN
// ============================================================
export default function EnrollmentPage() {
  const router = useRouter();
  const { isOpen: enrollmentOpen, loading: windowLoading, recheck: recheckWindow } = useEnrollmentWindow();

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [showPicker, setShowPicker] = useState(false);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);

  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', middleName: '', suffix: '', email: '',
    dob: '', age: '',
    birthplace: '', gender: '', nationality: 'Filipino', religion: '', address: '',
    motherName: '', motherOccupation: '', fatherName: '', fatherOccupation: '',
    guardian: '', guardianRelationship: '', guardianContact: '', guardianEmail: '', guardianAddress: '',
    gradeLevel: '', studentType: '', strand: '', tvlSpecialization: '',
    schoolYear: '',
  });
  const [files, setFiles] = useState<Record<string, any | null>>({});

  const formRef = useRef(form);
  formRef.current = form;

  const touchedRef = useRef(touched);
  touchedRef.current = touched;

  const errorsRef = useRef(errors);
  errorsRef.current = errors;

  // Auto school year once
  useEffect(() => {
    const y = new Date().getFullYear();
    const next = { ...formRef.current, schoolYear: `${y}-${y + 1}` };
    setForm(next);
    formRef.current = next;
  }, []);

  const showStrand = form.gradeLevel === 'Grade 11' || form.gradeLevel === 'Grade 12';
  const showTVLSpec = showStrand && form.strand === 'TVL';
  const availableTypes = form.gradeLevel ? STUDENT_TYPE_OPTIONS[form.gradeLevel] || {} : {};
  const requirements =
    form.gradeLevel && form.studentType
      ? REQUIREMENTS[form.gradeLevel]?.[form.studentType] || []
      : [];

  // ===== Validation =====
  const validateSingle = useCallback(
    (key: string, overrides?: Partial<FormState>): string | undefined => {
      const f = { ...formRef.current, ...(overrides || {}) };
      switch (key) {
        case 'firstName':
          if (!f.firstName.trim()) return 'First name is required';
          if (f.firstName.trim().length < 2) return 'At least 2 characters';
          if (!NAME_RE.test(f.firstName.trim())) return 'Letters, spaces, . - only';
          return;
        case 'lastName':
          if (!f.lastName.trim()) return 'Last name is required';
          if (f.lastName.trim().length < 2) return 'At least 2 characters';
          if (!NAME_RE.test(f.lastName.trim())) return 'Letters, spaces, . - only';
          return;
        case 'middleName':
          if (f.middleName.trim() && !NAME_RE.test(f.middleName.trim())) return 'Letters, spaces, . - only';
          return;
        case 'suffix':
          if (f.suffix.trim() && f.suffix.trim().length > 5) return 'Suffix too long';
          return;
        case 'email':
          if (!f.email.trim()) return 'Email is required';
          if (!EMAIL_RE.test(f.email.trim())) return 'Invalid email format';
          return;
        case 'dob':
          if (!f.dob) return 'Please pick your date of birth';
          return;
        case 'birthplace':
          if (!f.birthplace.trim()) return 'Place of birth is required';
          if (f.birthplace.trim().length < 3) return 'Too short';
          return;
        case 'gender':
          if (!f.gender) return 'Please select a gender';
          return;
        case 'nationality':
          if (!f.nationality.trim()) return 'Nationality is required';
          return;
        case 'address':
          if (!f.address.trim()) return 'Address is required';
          if (f.address.trim().length < 5) return 'Address too short';
          return;
        case 'motherName':
          if (!f.motherName.trim()) return "Mother's name is required";
          return;
        case 'fatherName':
          if (!f.fatherName.trim()) return "Father's name is required";
          return;
        case 'guardian':
          if (!f.guardian.trim()) return "Guardian's name is required";
          return;
        case 'guardianRelationship':
          if (!f.guardianRelationship.trim()) return 'Relationship is required';
          return;
        case 'guardianContact':
          if (!f.guardianContact.trim()) return 'Contact is required';
          if (!PHONE_RE.test(f.guardianContact.trim())) return 'Use 09XXXXXXXXX or +639XXXXXXXXX';
          return;
        case 'guardianEmail':
          if (f.guardianEmail.trim() && !EMAIL_RE.test(f.guardianEmail.trim())) return 'Invalid email format';
          return;
        case 'guardianAddress':
          if (!f.guardianAddress.trim()) return "Guardian's address is required";
          if (f.guardianAddress.trim().length < 5) return 'Address too short';
          return;
        case 'gradeLevel':
          if (!f.gradeLevel) return 'Please select a grade level';
          return;
        case 'studentType':
          if (!f.studentType) return 'Please select a student type';
          return;
        case 'strand':
          if (showStrand && !f.strand) return 'Please select a strand';
          return;
        case 'tvlSpecialization':
          if (showTVLSpec && !f.tvlSpecialization) return 'Please select a TVL specialization';
          return;
        case 'schoolYear':
          if (!f.schoolYear.trim()) return 'School year is required';
          if (!SCHOOL_YEAR_RE.test(f.schoolYear.trim())) return 'Format: YYYY-YYYY (e.g. 2026-2027)';
          return;
        default:
          return;
      }
    },
    [showStrand, showTVLSpec]
  );

  const validateAll = useCallback((): Record<string, string | undefined> => {
    const map: Record<string, string | undefined> = {};
    [
      'firstName', 'lastName', 'middleName', 'suffix', 'email', 'dob',
      'birthplace', 'gender', 'nationality', 'address',
      'motherName', 'fatherName', 'guardian', 'guardianRelationship',
      'guardianContact', 'guardianEmail', 'guardianAddress',
      'gradeLevel', 'studentType', 'strand', 'tvlSpecialization', 'schoolYear',
    ].forEach(k => {
      const msg = validateSingle(k);
      if (msg) map[k] = msg;
    });
    return map;
  }, [validateSingle]);

  // Generic field update
  const setField = useCallback(
    (key: keyof FormState, value: any) => {
      const next = { ...formRef.current, [key]: value };
      setForm(next);
      formRef.current = next;

      setTouched(prev => (prev[key] ? prev : { ...prev, [key]: true }));

      const msg = validateSingle(key as string, next);
      const prevErr = errorsRef.current[key];
      if (msg !== prevErr) {
        const newErrors = { ...errorsRef.current };
        if (msg) newErrors[key] = msg;
        else delete newErrors[key];
        setErrors(newErrors);
        errorsRef.current = newErrors;
      }
    },
    [validateSingle]
  );

  // ===== Atomic pickers =====
  const pickGrade = useCallback((g: string) => {
    const next: FormState = {
      ...formRef.current,
      gradeLevel: g,
      studentType: '',
      strand: '',
      tvlSpecialization: '',
    };
    setForm(next);
    formRef.current = next;
    setTouched(prev => ({ ...prev, gradeLevel: true }));
    setFiles({});

    const newErrors = { ...errorsRef.current };
    ['gradeLevel', 'studentType', 'strand', 'tvlSpecialization'].forEach(k => {
      const msg = validateSingle(k, next);
      if (msg) newErrors[k] = msg;
      else delete newErrors[k];
    });
    setErrors(newErrors);
    errorsRef.current = newErrors;
  }, [validateSingle]);

  const pickStudentType = useCallback((key: string) => {
    const next: FormState = { ...formRef.current, studentType: key };
    setForm(next);
    formRef.current = next;
    setTouched(prev => ({ ...prev, studentType: true }));

    const newErrors = { ...errorsRef.current };
    const msg = validateSingle('studentType', next);
    if (msg) newErrors.studentType = msg;
    else delete newErrors.studentType;
    setErrors(newErrors);
    errorsRef.current = newErrors;
  }, [validateSingle]);

  const pickStrand = useCallback((s: string) => {
    const next: FormState = {
      ...formRef.current,
      strand: s,
      tvlSpecialization: '',
    };
    setForm(next);
    formRef.current = next;
    setTouched(prev => ({ ...prev, strand: true }));

    const newErrors = { ...errorsRef.current };
    ['strand', 'tvlSpecialization'].forEach(k => {
      const msg = validateSingle(k, next);
      if (msg) newErrors[k] = msg;
      else delete newErrors[k];
    });
    setErrors(newErrors);
    errorsRef.current = newErrors;
  }, [validateSingle]);

  const pickTVLSpec = useCallback((s: string) => {
    const next: FormState = { ...formRef.current, tvlSpecialization: s };
    setForm(next);
    formRef.current = next;
    setTouched(prev => ({ ...prev, tvlSpecialization: true }));

    const newErrors = { ...errorsRef.current };
    const msg = validateSingle('tvlSpecialization', next);
    if (msg) newErrors.tvlSpecialization = msg;
    else delete newErrors.tvlSpecialization;
    setErrors(newErrors);
    errorsRef.current = newErrors;
  }, [validateSingle]);

  // Stable per-field handlers
  const handlers = React.useMemo(() => {
    const h: Record<string, (t: string) => void> = {};
    ([
      'firstName', 'lastName', 'middleName', 'suffix', 'email',
      'birthplace', 'nationality', 'religion', 'address',
      'motherName', 'motherOccupation', 'fatherName', 'fatherOccupation',
      'guardian', 'guardianRelationship', 'guardianContact', 'guardianEmail', 'guardianAddress',
      'schoolYear',
    ] as const).forEach(k => {
      h[k] = (t: string) => setField(k as any, t);
    });
    return h;
  }, [setField]);

  // Calendar
  const openCalendar = () => {
    Keyboard.dismiss();
    setShowPicker(true);
  };
  const onDateChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (!selected) return;
    if (event?.type === 'dismissed') return;
    if (selected > new Date()) {
      Alert.alert('Invalid Date', 'Date of birth cannot be in the future.');
      return;
    }
    setPickedDate(selected);
    const dobStr = formatYMD(selected);
    const ageStr = calcAgeFromDate(selected);
    const next = { ...formRef.current, dob: dobStr, age: ageStr };
    setForm(next);
    formRef.current = next;
    setTouched(prev => ({ ...prev, dob: true }));
    setErrors(prev => {
      if (!prev.dob) return prev;
      const n = { ...prev };
      delete n.dob;
      errorsRef.current = n;
      return n;
    });
  };

  // File picker
  const pickFile = async (field: string, accept: string) => {
    try {
      const types = accept.split(',').map(s => s.trim());
      const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      setFiles(prev => ({ ...prev, [field]: result.assets[0] }));
    } catch {
      Alert.alert('Error', 'Could not pick file.');
    }
  };
  const clearFile = (field: string) => {
    setFiles(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Submit
  const handleSubmit = async () => {
    Keyboard.dismiss();

    // 🔒 RACE-CONDITION GUARD: re-check enrollment window from DB right now
    const stillOpen = await recheckWindow();
    if (!stillOpen) {
      Alert.alert(
        'Enrollment Closed',
        "The enrollment window has just been closed by the administration.\n\nPlease proceed to walk-in enrollment at the school registrar's office.",
        [{ text: 'OK' }]
      );
      return;
    }

    const allTouched: Record<string, boolean> = {};
    [
      'firstName', 'lastName', 'middleName', 'suffix', 'email', 'dob',
      'birthplace', 'gender', 'nationality', 'address',
      'motherName', 'fatherName', 'guardian', 'guardianRelationship',
      'guardianContact', 'guardianEmail', 'guardianAddress',
      'gradeLevel', 'studentType', 'strand', 'tvlSpecialization', 'schoolYear',
    ].forEach(k => (allTouched[k] = true));
    setTouched(allTouched);

    const allErrors = validateAll();
    const missingDocs: string[] = [];
    requirements.forEach(r => {
      if (r.required && !files[r.field]) missingDocs.push(r.name);
    });

    if (Object.keys(allErrors).length > 0 || missingDocs.length > 0) {
      setErrors(allErrors);
      const issues = Object.keys(allErrors).map(k => `• ${k}`);
      let msg = '';
      if (issues.length > 0) msg += `Please fix:\n${issues.join('\n')}\n\n`;
      if (missingDocs.length > 0) msg += `Missing documents:\n${missingDocs.map(d => `• ${d}`).join('\n')}`;
      Alert.alert('Incomplete Form', msg.trim() || 'Please check the highlighted fields.');
      return;
    }

    setSubmitting(true);
    try {
      const submittedEmail = form.email.trim().toLowerCase();

      const { data: existing } = await supabase
        .from('enrollments')
        .select('*')
        .ilike('email', submittedEmail)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const row = existing[0];
        const st = (row.status || '').toLowerCase();
        if ((row.email || '').trim().toLowerCase() === submittedEmail &&
            ['enrolled', 'approved', 'pending'].includes(st)) {
          Alert.alert('Already Submitted', `An enrollment with this email already exists (${st.toUpperCase()}).`);
          setSubmitting(false);
          return;
        }
      }

      let studentId: string | null = null;
      const { data: existingStudent } = await supabase
        .from('students').select('id').ilike('email', submittedEmail).maybeSingle();
      if (existingStudent?.id) studentId = existingStudent.id;

      // 2x2 picture → data URL
      let twoByTwoDataUrl: string | null = null;
      const twoByTwoFile = files['two_by_two_picture'];
      if (twoByTwoFile) {
        try {
          const res = await fetch(twoByTwoFile.uri);
          const blob = await res.blob();
          twoByTwoDataUrl = await new Promise<string | null>(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string) || null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch {}
      }

      // Upload every other requirement file
      const uploadedUrls: Record<string, string | null> = {};
      for (const r of requirements) {
        const file = files[r.field];
        if (!file) continue;
        try {
          const ext = file.name?.split('.').pop() || 'bin';
          const key = `${submittedEmail.replace(/[^a-z0-9]/gi, '_')}_${r.field}_${Date.now()}.${ext}`;
          const path = `student_requirements/${key}`;
          const res = await fetch(file.uri);
          const blob = await res.blob();
          const { error: upErr } = await supabase.storage
            .from('student_documents')
            .upload(path, blob, { upsert: true, contentType: file.mimeType || 'application/octet-stream' });
          if (upErr) {
            uploadedUrls[r.field] = null;
            continue;
          }
          const { data: urlData } = supabase.storage.from('student_documents').getPublicUrl(path);
          uploadedUrls[r.field] = urlData.publicUrl;
        } catch {
          uploadedUrls[r.field] = null;
        }
      }

      const insertPayload: any = {
        student_id: studentId,
        email: submittedEmail,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        middle_name: form.middleName.trim() || null,
        suffix: form.suffix.trim() || null,
        dob: form.dob || null,
        date_of_birth: form.dob || null,
        age: form.age ? parseInt(form.age, 10) : null,
        birthplace: form.birthplace || null,
        gender: form.gender || null,
        nationality: form.nationality || null,
        religion: form.religion || null,
        address: form.address || null,
        contact_number: form.guardianContact || null,
        mother_name: form.motherName || null,
        mother_occupation: form.motherOccupation || null,
        father_name: form.fatherName || null,
        father_occupation: form.fatherOccupation || null,
        guardian_name: form.guardian || null,
        guardian_relationship: form.guardianRelationship || null,
        guardian_contact: form.guardianContact || null,
        guardian_email: form.guardianEmail || null,
        guardian_address: form.guardianAddress || null,
        student_type: form.studentType,
        grade_level: form.gradeLevel,
        strand: showTVLSpec ? form.tvlSpecialization : (showStrand ? form.strand : null),
        last_school_year: form.schoolYear,
        status: 'pending',
        two_by_two_picture_url: twoByTwoDataUrl,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      Object.entries(uploadedUrls).forEach(([field, url]) => {
        if (url) insertPayload[`${field}_url`] = url;
      });

      const { data: newEnr, error: enrError } = await supabase
        .from('enrollments').insert([insertPayload]).select();
      if (enrError) throw enrError;

      const createdId = newEnr?.[0]?.id ?? null;
      const fullName = `${form.firstName} ${form.lastName}`.trim();
      try {
        await supabase.from('notifications').insert([
          { role: 'admin', title: `📋 New Enrollment: ${fullName}`, message: `New enrollment: ${fullName} for ${form.gradeLevel}${showStrand ? ' - ' + form.strand : ''}.`, type: 'new_enrollment', enrollment_id: createdId, is_read: false, priority: 'high' },
          { role: 'registrar', title: `📋 New Enrollment: ${fullName}`, message: `New enrollment: ${fullName} for ${form.gradeLevel}${showStrand ? ' - ' + form.strand : ''}.`, type: 'new_enrollment', enrollment_id: createdId, is_read: false, priority: 'high' },
        ]);
      } catch {}

      Alert.alert(
        'Enrollment Submitted!',
        'Your enrollment form has been submitted successfully.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (e: any) {
      console.error(e);
      Alert.alert('Submission Failed', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const defaultPickerDate = pickedDate || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 15);
    return d;
  })();

  // ========== RENDER ==========
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <ImageBackground source={MATATAG_BG} style={styles.hero} imageStyle={styles.heroImage}>
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/home')} style={styles.heroIconBtn}>
              <Ionicons name="arrow-back" size={22} color={THEME.white} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.heroTitle}>Student Enrollment</Text>
              <Text style={styles.heroSub}>Fill out the form to enroll</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </ImageBackground>

        {/* ============================================================ */}
        {/* ENROLLMENT WINDOW — LOADING / CLOSED / OPEN                  */}
        {/* ============================================================ */}
        {windowLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={THEME.royalBlue} />
            <Text style={styles.loadingText}>Checking enrollment window…</Text>
          </View>
        ) : !enrollmentOpen ? (
          <View style={styles.closedCard}>
            <View style={styles.closedIconCircle}>
              <Ionicons name="lock-closed" size={36} color={THEME.danger} />
            </View>
            <Text style={styles.closedTitle}>Enrollment is now closed</Text>
            <Text style={styles.closedText}>
              The online enrollment window has ended.{'\n'}
              You can enroll now through{' '}
              <Text style={{ fontWeight: '800', color: THEME.royalBlue }}>walk-in</Text> at the
              school registrar's office.
            </Text>
            <TouchableOpacity
              style={styles.closedBackBtn}
              onPress={() => router.push('/(tabs)/home')}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back" size={16} color={THEME.white} />
              <Text style={styles.closedBackBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* PERSONAL */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="person" size={20} color={THEME.royalBlue} />
                <Text style={styles.cardTitle}>Personal Information</Text>
              </View>

              <Text style={styles.sectionTitle}>Full Name <Text style={styles.required}>*</Text></Text>
              <View style={styles.nameRow}>
                <View style={styles.nameInput}>
                  <TextField
                    field="lastName"
                    placeholder="Last Name"
                    placeholderTextColor={THEME.gray}
                    value={form.lastName}
                    onChangeText={handlers.lastName}
                    hasError={!!errors.lastName}
                    autoCorrect={false}
                    autoCapitalize="words"
                  />
                  {errors.lastName ? <Text style={styles.errorText}>⚠ {errors.lastName}</Text> : null}
                </View>
                <View style={styles.nameInput}>
                  <TextField
                    field="firstName"
                    placeholder="First Name"
                    placeholderTextColor={THEME.gray}
                    value={form.firstName}
                    onChangeText={handlers.firstName}
                    hasError={!!errors.firstName}
                    autoCorrect={false}
                    autoCapitalize="words"
                  />
                  {errors.firstName ? <Text style={styles.errorText}>⚠ {errors.firstName}</Text> : null}
                </View>
                <View style={styles.nameInput}>
                  <TextField
                    field="middleName"
                    placeholder="Middle Name"
                    placeholderTextColor={THEME.gray}
                    value={form.middleName}
                    onChangeText={handlers.middleName}
                    hasError={!!errors.middleName}
                    autoCorrect={false}
                    autoCapitalize="words"
                  />
                  {errors.middleName ? <Text style={styles.errorText}>⚠ {errors.middleName}</Text> : null}
                </View>
              </View>

              <Text style={styles.sectionTitle}>Email Address <Text style={styles.required}>*</Text></Text>
              <TextField
                field="email"
                placeholder="student@gmail.com"
                placeholderTextColor={THEME.gray}
                value={form.email}
                onChangeText={handlers.email}
                hasError={!!errors.email}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
              {errors.email ? <Text style={styles.errorText}>⚠ {errors.email}</Text> : null}

              <Text style={styles.sectionTitle}>Date of Birth <Text style={styles.required}>*</Text></Text>
              <TouchableOpacity
                style={[styles.input, styles.datePickerBtn, errors.dob && styles.inputError]}
                onPress={openCalendar}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={18} color={THEME.royalBlue} />
                <Text style={[styles.datePickerText, !pickedDate && styles.datePickerPlaceholder]}>
                  {pickedDate ? formatPretty(pickedDate) : 'Tap to pick your birthday'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={THEME.gray} />
              </TouchableOpacity>
              {errors.dob ? <Text style={styles.errorText}>⚠ {errors.dob}</Text> : null}

              <View style={styles.ageRow}>
                <View style={styles.ageBadge}>
                  <Ionicons name="hourglass-outline" size={14} color={THEME.royalBlue} />
                  <Text style={styles.ageText}>Age: <Text style={styles.ageValue}>{form.age || '—'}</Text></Text>
                </View>
              </View>

              {showPicker && (
                <DateTimePicker
                  value={defaultPickerDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  minimumDate={new Date(1900, 0, 1)}
                  onChange={onDateChange}
                />
              )}

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Place of Birth <Text style={styles.required}>*</Text></Text>
                  <TextField
                    field="birthplace"
                    placeholder="City/Municipality, Province"
                    placeholderTextColor={THEME.gray}
                    value={form.birthplace}
                    onChangeText={handlers.birthplace}
                    hasError={!!errors.birthplace}
                  />
                  {errors.birthplace ? <Text style={styles.errorText}>⚠ {errors.birthplace}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Gender <Text style={styles.required}>*</Text></Text>
                  <View style={styles.pillRow}>
                    {['Male', 'Female'].map(g => {
                      const active = form.gender === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[styles.pill, active && styles.pillActive, errors.gender && !active && styles.pillError]}
                          onPress={() => setField('gender', g)}
                        >
                          <Text style={[styles.pillText, active && styles.pillTextActive]}>{g}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {errors.gender ? <Text style={styles.errorText}>⚠ {errors.gender}</Text> : null}
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Nationality <Text style={styles.required}>*</Text></Text>
                  <TextField
                    field="nationality"
                    value={form.nationality}
                    onChangeText={handlers.nationality}
                    hasError={!!errors.nationality}
                  />
                  {errors.nationality ? <Text style={styles.errorText}>⚠ {errors.nationality}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Religion</Text>
                  <TextField
                    field="religion"
                    placeholder="Roman Catholic"
                    placeholderTextColor={THEME.gray}
                    value={form.religion}
                    onChangeText={handlers.religion}
                    hasError={!!errors.religion}
                  />
                </View>
              </View>

              <Text style={styles.sectionTitle}>Home Address <Text style={styles.required}>*</Text></Text>
              <TextField
                field="address"
                placeholder="Street, Barangay, City/Municipality, Province"
                placeholderTextColor={THEME.gray}
                value={form.address}
                onChangeText={handlers.address}
                hasError={!!errors.address}
                multiline
                style={styles.textArea}
              />
              {errors.address ? <Text style={styles.errorText}>⚠ {errors.address}</Text> : null}
            </View>

            {/* PARENT */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="people" size={20} color={THEME.royalBlue} />
                <Text style={styles.cardTitle}>Parent / Guardian Information</Text>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Mother's Name <Text style={styles.required}>*</Text></Text>
                  <TextField field="motherName" value={form.motherName} onChangeText={handlers.motherName} hasError={!!errors.motherName} />
                  {errors.motherName ? <Text style={styles.errorText}>⚠ {errors.motherName}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Mother's Occupation</Text>
                  <TextField field="motherOccupation" value={form.motherOccupation} onChangeText={handlers.motherOccupation} />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Father's Name <Text style={styles.required}>*</Text></Text>
                  <TextField field="fatherName" value={form.fatherName} onChangeText={handlers.fatherName} hasError={!!errors.fatherName} />
                  {errors.fatherName ? <Text style={styles.errorText}>⚠ {errors.fatherName}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Father's Occupation</Text>
                  <TextField field="fatherOccupation" value={form.fatherOccupation} onChangeText={handlers.fatherOccupation} />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Guardian's Name <Text style={styles.required}>*</Text></Text>
                  <TextField field="guardian" value={form.guardian} onChangeText={handlers.guardian} hasError={!!errors.guardian} />
                  {errors.guardian ? <Text style={styles.errorText}>⚠ {errors.guardian}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Relationship <Text style={styles.required}>*</Text></Text>
                  <TextField
                    field="guardianRelationship"
                    placeholder="Parent, Sibling, etc."
                    placeholderTextColor={THEME.gray}
                    value={form.guardianRelationship}
                    onChangeText={handlers.guardianRelationship}
                    hasError={!!errors.guardianRelationship}
                  />
                  {errors.guardianRelationship ? <Text style={styles.errorText}>⚠ {errors.guardianRelationship}</Text> : null}
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Guardian's Contact <Text style={styles.required}>*</Text></Text>
                  <TextField
                    field="guardianContact"
                    placeholder="09XX XXX XXXX"
                    placeholderTextColor={THEME.gray}
                    keyboardType="phone-pad"
                    value={form.guardianContact}
                    onChangeText={handlers.guardianContact}
                    hasError={!!errors.guardianContact}
                  />
                  {errors.guardianContact ? <Text style={styles.errorText}>⚠ {errors.guardianContact}</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Guardian's Email</Text>
                  <TextField
                    field="guardianEmail"
                    placeholder="guardian@email.com"
                    placeholderTextColor={THEME.gray}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={form.guardianEmail}
                    onChangeText={handlers.guardianEmail}
                    hasError={!!errors.guardianEmail}
                  />
                  {errors.guardianEmail ? <Text style={styles.errorText}>⚠ {errors.guardianEmail}</Text> : null}
                </View>
              </View>

              <Text style={styles.sectionTitle}>Guardian's Address <Text style={styles.required}>*</Text></Text>
              <TextField
                field="guardianAddress"
                value={form.guardianAddress}
                onChangeText={handlers.guardianAddress}
                hasError={!!errors.guardianAddress}
                multiline
                style={styles.textArea}
              />
              {errors.guardianAddress ? <Text style={styles.errorText}>⚠ {errors.guardianAddress}</Text> : null}
            </View>

            {/* ACADEMIC */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="book" size={20} color={THEME.royalBlue} />
                <Text style={styles.cardTitle}>Grade Level & Strand</Text>
              </View>

              <Text style={styles.sectionTitle}>Applying for Grade Level <Text style={styles.required}>*</Text></Text>
              <View style={styles.pillWrap}>
                {GRADE_LEVELS.map(g => {
                  const active = form.gradeLevel === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[styles.pillSmall, active && styles.pillActive, errors.gradeLevel && !active && styles.pillError]}
                      onPress={() => pickGrade(g)}
                    >
                      <Text style={[styles.pillTextSmall, active && styles.pillTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {errors.gradeLevel ? <Text style={styles.errorText}>⚠ {errors.gradeLevel}</Text> : null}

              {form.gradeLevel && (
                <>
                  <Text style={styles.sectionTitle}>Student Type <Text style={styles.required}>*</Text></Text>
                  <View style={styles.pillWrap}>
                    {Object.entries(availableTypes).map(([key, label]) => {
                      const active = form.studentType === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[styles.pillSmall, active && styles.pillActive, errors.studentType && !active && styles.pillError]}
                          onPress={() => pickStudentType(key)}
                        >
                          <Text style={[styles.pillTextSmall, active && styles.pillTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {errors.studentType ? <Text style={styles.errorText}>⚠ {errors.studentType}</Text> : null}
                </>
              )}

              {showStrand && (
                <>
                  <Text style={styles.sectionTitle}>Select Strand <Text style={styles.required}>*</Text></Text>
                  <View style={styles.pillWrap}>
                    {STRANDS.map(s => {
                      const active = form.strand === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.pillSmall, active && styles.pillActive, errors.strand && !active && styles.pillError]}
                          onPress={() => pickStrand(s)}
                        >
                          <Text style={[styles.pillTextSmall, active && styles.pillTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {errors.strand ? <Text style={styles.errorText}>⚠ {errors.strand}</Text> : null}
                </>
              )}

              {showTVLSpec && (
                <>
                  <Text style={styles.sectionTitle}>TVL Specialization <Text style={styles.required}>*</Text></Text>
                  <View style={styles.pillWrap}>
                    {TVL_SPECS.map(s => {
                      const active = form.tvlSpecialization === s;
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[styles.pillSmall, active && styles.pillActive, errors.tvlSpecialization && !active && styles.pillError]}
                          onPress={() => pickTVLSpec(s)}
                        >
                          <Text style={[styles.pillTextSmall, active && styles.pillTextActive]}>{s}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {errors.tvlSpecialization ? <Text style={styles.errorText}>⚠ {errors.tvlSpecialization}</Text> : null}
                </>
              )}

              <Text style={styles.sectionTitle}>School Year <Text style={styles.required}>*</Text></Text>
              <TextField
                field="schoolYear"
                placeholder="e.g., 2026-2027"
                placeholderTextColor={THEME.gray}
                value={form.schoolYear}
                onChangeText={handlers.schoolYear}
                hasError={!!errors.schoolYear}
              />
              {errors.schoolYear ? <Text style={styles.errorText}>⚠ {errors.schoolYear}</Text> : null}
            </View>

            {/* REQUIREMENTS */}
            {requirements.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="attach" size={20} color={THEME.royalBlue} />
                  <Text style={styles.cardTitle}>Required Documents</Text>
                </View>
                <Text style={styles.cardSubtitle}>Please upload the following documents</Text>
                {requirements.map(def => {
                  const file = files[def.field];
                  return (
                    <View key={def.field} style={styles.fileCard}>
                      <View style={styles.fileHeader}>
                        <Text style={styles.fileName} numberOfLines={2}>{def.name}</Text>
                        <View style={[styles.badge, def.required ? styles.badgeRequired : styles.badgeOptional]}>
                          <Text style={[styles.badgeText, def.required ? styles.badgeTextRequired : styles.badgeTextOptional]}>
                            {def.required ? 'Required' : 'Optional'}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.uploadArea, file && styles.uploadAreaSuccess]}
                        onPress={() => pickFile(def.field, def.accept)}
                        activeOpacity={0.85}
                      >
                        <Ionicons
                          name={file ? 'checkmark-circle' : 'cloud-upload-outline'}
                          size={20}
                          color={file ? THEME.success : THEME.royalBlue}
                        />
                        <Text style={[styles.uploadText, file && styles.uploadTextSuccess]} numberOfLines={1}>
                          {file ? file.name : 'Tap to upload'}
                        </Text>
                        {file && (
                          <TouchableOpacity onPress={() => clearFile(def.field)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close-circle" size={18} color={THEME.danger} />
                          </TouchableOpacity>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={THEME.white} />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={THEME.white} />
                  <Text style={styles.submitBtnText}>Submit Enrollment</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backLink}
              onPress={() => router.push('/(tabs)/home')}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={14} color={THEME.gray} />
              <Text style={styles.backLinkText}>Back to Home</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: THEME.offWhite },
  container: { flex: 1, padding: 16 },

  hero: { width: '100%', minHeight: 160, justifyContent: 'center', marginBottom: 16, borderRadius: 18, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30,58,138,0.65)' },
  heroContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, zIndex: 2, width: '100%' },
  heroIconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: THEME.white, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },

  card: { backgroundColor: THEME.white, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: THEME.offWhiteDark },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: THEME.black },
  cardSubtitle: { fontSize: 12, color: THEME.gray, marginBottom: 12 },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: THEME.black, marginBottom: 6, marginTop: 4 },
  required: { color: THEME.danger },
  input: { backgroundColor: THEME.offWhite, borderRadius: 10, borderWidth: 1, borderColor: THEME.offWhiteDark, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: THEME.black, marginBottom: 10 },
  inputError: { borderColor: THEME.danger, backgroundColor: '#FEF2F2' },
  errorText: { fontSize: 11, color: THEME.danger, fontWeight: '600', marginTop: -6, marginBottom: 8 },
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  nameRow: { flexDirection: 'row', gap: 8 },
  nameInput: { flex: 1 },
  row: { flexDirection: 'row', gap: 10 },

  datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  datePickerText: { flex: 1, fontSize: 14, color: THEME.black, fontWeight: '600' },
  datePickerPlaceholder: { color: THEME.gray, fontWeight: '400' },
  ageRow: { flexDirection: 'row', marginTop: -4, marginBottom: 6 },
  ageBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: THEME.royalBlue + '12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: THEME.royalBlue + '30' },
  ageText: { fontSize: 12, color: THEME.darkGray },
  ageValue: { fontSize: 13, fontWeight: '800', color: THEME.royalBlue },

  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  pill: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: THEME.offWhite, alignItems: 'center', borderWidth: 1, borderColor: THEME.offWhiteDark },
  pillSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: THEME.offWhite, borderWidth: 1, borderColor: THEME.offWhiteDark },
  pillActive: { backgroundColor: THEME.royalBlue, borderColor: THEME.royalBlue },
  pillError: { borderColor: THEME.danger },
  pillText: { fontSize: 12, fontWeight: '600', color: THEME.royalBlue },
  pillTextSmall: { fontSize: 11, fontWeight: '600', color: THEME.royalBlue },
  pillTextActive: { color: THEME.white, fontWeight: '800' },

  fileCard: { backgroundColor: THEME.offWhite, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: THEME.offWhiteDark },
  fileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  fileName: { flex: 1, fontSize: 13, fontWeight: '600', color: THEME.black },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeRequired: { backgroundColor: '#FEE2E2' },
  badgeOptional: { backgroundColor: '#E0F2FE' },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  badgeTextRequired: { color: '#B91C1C' },
  badgeTextOptional: { color: THEME.royalBlue },
  uploadArea: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: THEME.royalBlue + '40', backgroundColor: THEME.white },
  uploadAreaSuccess: { borderColor: THEME.success, backgroundColor: '#F0FDF4' },
  uploadText: { flex: 1, fontSize: 12, color: THEME.royalBlue, fontWeight: '600' },
  uploadTextSuccess: { color: THEME.success },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: THEME.royalBlue, borderRadius: 14, paddingVertical: 16, marginBottom: 12 },
  submitBtnText: { color: THEME.white, fontSize: 15, fontWeight: '800' },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  backLinkText: { fontSize: 13, color: THEME.gray, fontWeight: '600' },

  // ---- Enrollment window states ----
  loadingCard: {
    backgroundColor: THEME.white,
    borderRadius: 18,
    padding: 40,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.offWhiteDark,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: THEME.gray,
    fontWeight: '600',
  },
  closedCard: {
    backgroundColor: THEME.white,
    borderRadius: 18,
    padding: 30,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.offWhiteDark,
  },
  closedIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  closedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  closedText: {
    fontSize: 14,
    color: THEME.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  closedBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.royalBlue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  closedBackBtnText: {
    color: THEME.white,
    fontSize: 14,
    fontWeight: '800',
  },
});