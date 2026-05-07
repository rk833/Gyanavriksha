import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ResultNavigation = {
  navigate: (screenName: string, params?: Record<string, unknown>) => void;
};

type ResultRoute = {
  params?: {
    submissionId?: string;
  };
};

type SubmissionResultScreenProps = {
  navigation: ResultNavigation;
  route?: ResultRoute;
};

export default function SubmissionResultScreen({ navigation, route }: SubmissionResultScreenProps) {
  const submissionId = route?.params?.submissionId ?? '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Submission Completed</Text>
        <Text style={styles.subtitle}>Result view will be connected to grading feedback once available.</Text>
        <Text style={styles.meta}>Submission ID: {submissionId || 'N/A'}</Text>

        <TouchableOpacity style={styles.primaryButton} activeOpacity={0.85} onPress={() => navigation.navigate('SubmissionDetailsScreen')}>
          <Text style={styles.primaryButtonText}>View Submissions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.secondaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F1EB',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    color: '#64748B',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
  },
});
