import type { ReactNode } from 'react';
import type {
  ImageSourcePropType,
  StyleProp,
  ViewStyle,
} from 'react-native';

export type AppleServiceIconKind =
  | 'icloud'
  | 'files'
  | 'app-store'
  | 'messages';

export type AppleSignInSpeedMode = 'slow' | 'normal' | 'fast';

export interface AppleSignInIcon {
  key: string;
  /** Custom artwork. When omitted, `kind` renders an iOS-inspired fallback. */
  element?: ReactNode;
  kind?: AppleServiceIconKind;
  /** Preferred carrier-particle angle; the nearest outer particle is selected. */
  startAngle?: number;
  /** Tint blended into the selected particle while it is enlarged. */
  carrierColor?: string;
  accessibilityLabel?: string;
}

export interface AppleSignInAnimationProps {
  avatarSource: ImageSourcePropType;
  userName: string;
  icons?: AppleSignInIcon[];
  size?: number;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  /** Playback rate. `1` / `'normal'` is real time. */
  speed?: number | AppleSignInSpeedMode;
}
