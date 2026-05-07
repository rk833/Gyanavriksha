import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAppTheme } from '../context/ThemeContext';

type Props = {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
  showBack?: boolean;
  onBackPress?: () => void;
  rightSlot?: React.ReactNode;
  onBellPress?: () => void;
  unreadCount?: number;
};

export default function ScreenHeader({
  title,
  subtitle,
  showLogo = false,
  showBack = false,
  onBackPress,
  rightSlot,
  onBellPress,
  unreadCount = 0,
}: Props) {
  const { theme } = useAppTheme();
  const nav = useNavigation();

  const handleBack = () => {
    if (onBackPress) return onBackPress();
    nav.goBack();
  };

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.colors.primarySoft }]}
            activeOpacity={0.8}
            onPress={handleBack}
          >
            <MaterialIcons name="arrow-back" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
        {showLogo && !showBack && (
          <Image source={require('../../assets/logo-icon.png')} style={styles.logo} resizeMode="contain" />
        )}
        <View style={styles.titleWrap}>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.colors.muted }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {title ? (
            <Text style={[styles.title, { color: theme.colors.primary }]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        {rightSlot}
        {onBellPress && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: theme.colors.primarySoft }]}
            activeOpacity={0.8}
            onPress={onBellPress}
          >
            <MaterialIcons name="notifications-none" size={20} color={theme.colors.primary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 56,
    borderBottomWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  logo: { width: 32, height: 32 },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '800' },
  subtitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  badge: {
    position: 'absolute', top: -2, right: -2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#DC2626', borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
});
