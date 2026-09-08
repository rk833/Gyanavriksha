import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

type Props = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: Props) {
  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(24)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const pillOpacity = useRef(new Animated.Value(0)).current;
  const ringScale1 = useRef(new Animated.Value(0)).current;
  const ringOpacity1 = useRef(new Animated.Value(0.6)).current;
  const ringScale2 = useRef(new Animated.Value(0)).current;
  const ringOpacity2 = useRef(new Animated.Value(0.4)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const rotateInterp = logoRotate.interpolate({
      inputRange: [0, 1],
      outputRange: ['-15deg', '0deg'],
    });

    // Phase 1: Rings pulse in + logo bounces in
    Animated.parallel([
      Animated.timing(ringScale1, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity1, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(ringScale2, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(100),
        Animated.timing(ringOpacity2, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2: Title slides up
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Phase 3: Subtitle + pill fade in
        Animated.parallel([
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(pillOpacity, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => {
          // Hold for a moment, then fade out
          Animated.sequence([
            Animated.delay(900),
            Animated.timing(screenOpacity, {
              toValue: 0,
              duration: 500,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ]).start(() => onFinish());
        });
      });
    });
  }, []);

  const logoRotateInterp = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-12deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar style="light" />

      {/* Background gradient circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      {/* Pulse rings */}
      <Animated.View style={[styles.ring, {
        transform: [{ scale: ringScale1.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] }) }],
        opacity: ringOpacity1,
      }]} />
      <Animated.View style={[styles.ring, styles.ring2, {
        transform: [{ scale: ringScale2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.8] }) }],
        opacity: ringOpacity2,
      }]} />

      {/* Main content */}
      <View style={styles.content}>
        {/* Logo */}
        <Animated.View style={[styles.logoWrap, {
          opacity: logoOpacity,
          transform: [{ scale: logoScale }, { rotate: logoRotateInterp }],
        }]}>
          <View style={styles.logoGlow} />
          <Image
            source={require('../../assets/logo-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Title */}
        <Animated.Text style={[styles.title, {
          opacity: titleOpacity,
          transform: [{ translateY: titleTranslateY }],
        }]}>
          Gyanavriksha
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitle, { opacity: subtitleOpacity }]}>
          Learning Ecosystem for{'\n'}Nepal's Secondary Education
        </Animated.Text>

        {/* Feature pills */}
        <Animated.View style={[styles.pillsRow, { opacity: pillOpacity }]}>
          {['AI Tutor', 'Smart Quizzes', 'IoT Desk'].map((label) => (
            <View key={label} style={styles.pill}>
              <Text style={styles.pillText}>{label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Bottom branding */}
      <Animated.View style={[styles.bottomWrap, { opacity: subtitleOpacity }]}>
        <View style={styles.bottomDivider} />
        <Text style={styles.bottomText}>Powered by AI & IoT</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B2645',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  bgCircle3: {
    position: 'absolute',
    top: '40%',
    right: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(100,180,255,0.06)',
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ring2: {
    borderColor: 'rgba(100,180,255,0.4)',
  },
  content: {
    alignItems: 'center',
    gap: 0,
  },
  logoWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(100,200,255,0.12)',
  },
  logo: {
    width: 110,
    height: 110,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomWrap: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 10,
  },
  bottomDivider: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  bottomText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
