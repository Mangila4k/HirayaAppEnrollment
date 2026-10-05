import { ThemeProvider } from '@/app/_context/themecontext';
import { Stack } from 'expo-router';

export default function DashboardLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="admin" />
        <Stack.Screen name="student" />
        <Stack.Screen name="teacher" />
        <Stack.Screen name="parent" />
        <Stack.Screen name="registrar" />
      </Stack>
    </ThemeProvider>
  );
}