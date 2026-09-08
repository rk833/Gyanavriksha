import { TextStyle } from 'react-native';

/**
 * Reusable text styles (pair with theme.colors.* for color).
 * Import: `import { appTypography } from '../theme/typography'`
 */
export const appTypography = {
  screenTitle: { fontSize: 22, fontWeight: '800' } satisfies TextStyle,
  sectionTitle: { fontSize: 16, fontWeight: '800' } satisfies TextStyle,
  body: { fontSize: 14, fontWeight: '500' } satisfies TextStyle,
  bodyStrong: { fontSize: 14, fontWeight: '700' } satisfies TextStyle,
  caption: { fontSize: 12, fontWeight: '600' } satisfies TextStyle,
  statNumber: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 } satisfies TextStyle,
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  } satisfies TextStyle,
} as const;
