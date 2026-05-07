import React, { useState } from 'react';
import {
  Animated,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { useAppTheme } from '../../context/ThemeContext';
import ScreenHeader from '../../components/ScreenHeader';

// ─── Types ─────────────────────────────────────────────────────────────────────

type FAQItem = {
  q: string;
  a: string;
};

type Tab = 'faq' | 'about' | 'legal';

// ─── Data ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'How do I submit an assignment?',
    a: 'Go to the Submit tab, select an assignment, then take a photo or upload an image of your work. The system will automatically process and grade your submission.',
  },
  {
    q: 'What is the AI Tutor?',
    a: 'The AI Tutor is a RAG-powered chatbot that answers your subject-related questions using your course material. Open the Chat tab to start a conversation or continue a previous session.',
  },
  {
    q: 'How do Micro Quizzes work?',
    a: 'Micro Quizzes are short adaptive assessments tailored to your weaknesses. Go to the Learn tab → Quizzes to take existing quizzes or generate a new one for a specific concept.',
  },
  {
    q: 'What are Knowledge Gaps?',
    a: 'Knowledge Gaps are concepts where the system has detected repeated difficulty based on your submissions and quiz results. Resolving them (by scoring well on related quizzes) marks them as resolved.',
  },
  {
    q: 'What is Exam Mode?',
    a: 'Exam Mode activates IoT monitoring during timed assessments. A desk sensor tracks your presence. If you leave your desk too long, the session auto-pauses. Too many auto-pauses forfeit the attempt.',
  },
  {
    q: 'How do I check my IoT device status?',
    a: 'Tap the IoT vitals card on your Dashboard, or navigate to the IoT Status page from your Profile. It shows sensor readings (distance, LDR, LED) and device connectivity.',
  },
  {
    q: 'Where can I see my performance?',
    a: 'Go to Profile → Performance. You can view your average score, trend, streak, score progression charts, hardest topics, and AI-generated improvement tips.',
  },
  {
    q: 'How do I access curriculum documents?',
    a: 'Go to Profile → Library. You can search, filter by subject, and download any curriculum documents uploaded by your instructors.',
  },
  {
    q: 'How do I change my password?',
    a: 'Go to Profile → Change Password. Enter your current password and then your new password twice to confirm.',
  },
  {
    q: 'What does my submission score mean?',
    a: 'Scores are calculated by the AI grading system based on the quality and accuracy of your written answers. A higher percentage means a better match to the expected answer key. Grade classifications (A, B, C, D) are assigned based on score ranges.',
  },
];

// ─── AccordionItem ─────────────────────────────────────────────────────────────

function AccordionItem({ item, theme }: { item: FAQItem; theme: ReturnType<typeof useAppTheme>['theme'] }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.accordionWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.accordionHeader}
        onPress={() => setOpen((o) => !o)}
      >
        <Text style={[styles.accordionQ, { color: theme.colors.primary }]}>{item.q}</Text>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          color={theme.colors.muted}
        />
      </TouchableOpacity>
      {open && (
        <View style={[styles.accordionBody, { borderTopColor: theme.colors.border }]}>
          <Text style={[styles.accordionA, { color: theme.colors.text }]}>{item.a}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

const CONTACT_EMAIL = 'support@gyanavriksha.edu';

export default function HelpScreen() {
  const { theme } = useAppTheme();
  const [activeTab, setActiveTab] = useState<Tab>('faq');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.screen }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Help & Support" subtitle="Resources" showBack />
      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        {(
          [
            { key: 'faq', label: 'FAQ', icon: 'help-outline' },
            { key: 'about', label: 'About', icon: 'info-outline' },
            { key: 'legal', label: 'Legal', icon: 'gavel' },
          ] as { key: Tab; label: string; icon: keyof typeof MaterialIcons.glyphMap }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(t.key)}
          >
            <MaterialIcons name={t.icon} size={18} color={activeTab === t.key ? theme.colors.primary : theme.colors.muted} />
            <Text style={[styles.tabLabel, { color: activeTab === t.key ? theme.colors.primary : theme.colors.muted }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── FAQ ── */}
        {activeTab === 'faq' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.colors.primary }]}>Frequently Asked Questions</Text>
            {FAQ_ITEMS.map((item, idx) => (
              <AccordionItem key={idx} item={item} theme={theme} />
            ))}
            <View style={[styles.contactCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <MaterialIcons name="mail-outline" size={22} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactTitle, { color: theme.colors.primary }]}>Still need help?</Text>
                <Text style={[styles.contactBody, { color: theme.colors.muted }]}>
                  Contact your instructor or reach us at{' '}
                  <Text
                    style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}
                    onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}
                  >
                    {CONTACT_EMAIL}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── About ── */}
        {activeTab === 'about' && (
          <View style={styles.section}>
            <View style={[styles.heroCard, { backgroundColor: theme.colors.primary }]}>
              <MaterialIcons name="school" size={48} color="#FFFFFF" />
              <Text style={styles.heroTitle}>Gyanavriksha</Text>
              <Text style={styles.heroSubtitle}>Smart Education Platform</Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.infoCardTitle, { color: theme.colors.primary }]}>What is Gyanavriksha?</Text>
              <Text style={[styles.infoCardBody, { color: theme.colors.text }]}>
                Gyanavriksha is an AI-powered learning management system that bridges traditional classroom education
                with cutting-edge technology. It combines Retrieval-Augmented Generation (RAG) AI, IoT desk monitoring,
                and adaptive micro-quiz assessments to personalise your learning journey.
              </Text>
            </View>

            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.infoCardTitle, { color: theme.colors.primary }]}>Key Features</Text>
              {[
                { icon: 'psychology', label: 'AI Tutor', desc: 'Ask questions grounded in your curriculum.' },
                { icon: 'quiz', label: 'Micro Quizzes', desc: 'Adaptive quizzes targeting your weak areas.' },
                { icon: 'insights', label: 'Knowledge Gaps', desc: 'Auto-detected concepts you need to revisit.' },
                { icon: 'sensors', label: 'IoT Monitoring', desc: 'Desk presence detection during exams.' },
                { icon: 'grading', label: 'AI Grading', desc: 'Automated OCR + LLM grading of submissions.' },
                { icon: 'bar-chart', label: 'Performance Analytics', desc: 'Track your score trends and streaks.' },
              ].map((f, idx) => (
                <View key={idx} style={styles.featureRow}>
                  <View style={[styles.featureIconWrap, { backgroundColor: theme.colors.primarySoft }]}>
                    <MaterialIcons name={f.icon as keyof typeof MaterialIcons.glyphMap} size={18} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureLabel, { color: theme.colors.primary }]}>{f.label}</Text>
                    <Text style={[styles.featureDesc, { color: theme.colors.muted }]}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.infoCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[styles.infoCardTitle, { color: theme.colors.primary }]}>App Info</Text>
              {[
                { label: 'Version', value: '1.0.0' },
                { label: 'Build', value: 'Production' },
                { label: 'Platform', value: 'React Native (Expo)' },
                { label: 'Backend', value: 'FastAPI + PostgreSQL' },
                { label: 'AI', value: 'RAG + LLM (ChromaDB)' },
                { label: 'IoT', value: 'MQTT + ESP8266 Ultrasonic' },
              ].map((row, idx) => (
                <View key={idx} style={[styles.infoRow, { borderTopColor: theme.colors.border }]}>
                  <Text style={[styles.infoRowLabel, { color: theme.colors.muted }]}>{row.label}</Text>
                  <Text style={[styles.infoRowValue, { color: theme.colors.primary }]}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Legal ── */}
        {activeTab === 'legal' && (
          <View style={styles.section}>
            {/* Privacy Policy */}
            <View style={[styles.legalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.legalHeader}>
                <MaterialIcons name="privacy-tip" size={20} color={theme.colors.primary} />
                <Text style={[styles.legalTitle, { color: theme.colors.primary }]}>Privacy Policy</Text>
              </View>
              <Text style={[styles.legalBody, { color: theme.colors.text }]}>
                {`Gyanavriksha collects only the data necessary to provide educational services: your name, email, assignment submissions, and IoT sensor data during exams.\n\nData Collected:\n• Account information (name, email)\n• Assignment submissions and images\n• AI chat history\n• Quiz results and knowledge gap data\n• IoT sensor readings (distance, light) during exam sessions\n\nData Usage:\n• To grade your assignments automatically using AI\n• To personalise learning recommendations\n• To monitor your presence during IoT-enabled exams\n• To generate performance analytics\n\nData Retention:\nYour data is retained for the duration of your enrolment. You may request deletion by contacting your institution administrator.\n\nWe do not sell your personal data to third parties.`}
              </Text>
            </View>

            {/* Terms of Service */}
            <View style={[styles.legalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.legalHeader}>
                <MaterialIcons name="gavel" size={20} color={theme.colors.primary} />
                <Text style={[styles.legalTitle, { color: theme.colors.primary }]}>Terms of Service</Text>
              </View>
              <Text style={[styles.legalBody, { color: theme.colors.text }]}>
                {`By using Gyanavriksha, you agree to the following terms:\n\n1. Academic Integrity\nYou must not submit work that is not your own. IoT monitoring during exams is used to ensure a fair environment for all students.\n\n2. Acceptable Use\nThis platform is for educational purposes only. Attempting to manipulate AI grading, bypass IoT monitoring, or exploit system vulnerabilities is prohibited.\n\n3. Account Security\nYou are responsible for keeping your credentials secure. Enable two-factor authentication for additional protection.\n\n4. Content\nSubmission images and chat messages are processed by AI. By submitting content, you grant Gyanavriksha a licence to process it for educational purposes.\n\n5. Availability\nWe aim to maintain high availability but do not guarantee uninterrupted access. Exam sessions affected by outages will be reviewed individually.\n\n6. Changes to Terms\nWe may update these terms with notice provided through the app.`}
              </Text>
            </View>

            {/* Cookie Policy */}
            <View style={[styles.legalCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={styles.legalHeader}>
                <MaterialIcons name="cookie" size={20} color={theme.colors.primary} />
                <Text style={[styles.legalTitle, { color: theme.colors.primary }]}>Cookie & Storage Policy</Text>
              </View>
              <Text style={[styles.legalBody, { color: theme.colors.text }]}>
                {`The Gyanavriksha mobile app uses secure device storage (expo-secure-store) to save authentication tokens locally. No tracking cookies are used.\n\nStored Data:\n• Access token (JWT) — used for API authentication\n• Refresh token — used to renew sessions without re-login\n• Theme preference — stored locally for display settings\n\nThis data is stored only on your device and is never shared with advertisers or third parties.`}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
  },
  tabLabel: { fontSize: 13, fontWeight: '700' },
  content: { padding: 14, paddingBottom: 36 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  accordionWrap: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    gap: 8,
  },
  accordionQ: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  accordionBody: { padding: 14, borderTopWidth: 1 },
  accordionA: { fontSize: 13, lineHeight: 20 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  contactTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  contactBody: { fontSize: 13, lineHeight: 19 },
  heroCard: {
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  infoCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  infoCardTitle: { fontSize: 15, fontWeight: '800' },
  infoCardBody: { fontSize: 13, lineHeight: 21 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  featureLabel: { fontSize: 13, fontWeight: '800' },
  featureDesc: { fontSize: 12, marginTop: 1 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1 },
  infoRowLabel: { fontSize: 12 },
  infoRowValue: { fontSize: 12, fontWeight: '700' },
  legalCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  legalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legalTitle: { fontSize: 15, fontWeight: '800' },
  legalBody: { fontSize: 12, lineHeight: 20 },
});
