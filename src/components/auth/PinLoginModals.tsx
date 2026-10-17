import React from 'react';
import {
  Animated,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Delete, KeyRound, X } from 'lucide-react-native';
import { useTheme } from '../../config/ThemeContext';
import { makeStyles } from '../../screens/PinLoginScreen.styles';
import { WelcomeGreetingModal } from '../WelcomeGreetingModal';

export type ChangePinStep = 'VERIFY_OLD' | 'ENTER_NEW' | 'CONFIRM_NEW';

export interface PinLoginModalsProps {
  // Modal Ganti PIN Kasir
  changePinModalVisible: boolean;
  onCloseChangePinModal: () => void;
  changePinStep: ChangePinStep;
  activeProfileName: string;
  changePinInput: string;
  changePinError?: string;
  modalShake?: Animated.Value;
  onModalNumPress: (val: string) => void;
  onModalDeletePress: () => void;
  pinLength?: number;
  isSavingChangePin?: boolean;

  // Modal Greeting Selamat Datang
  welcomeVisible?: boolean;
  welcomeCashierName?: string;
  welcomeIsFirstTime?: boolean;
  onWelcomeDismiss?: () => void;

  // Gaya opsional jika dioper dari parent
  styles?: any;
}

/**
 * Komponen Modular Modal Dialog Autentikasi / PIN Kasir:
 * 1. Modal Interaktif Ganti PIN Kasir (3-Step stepper: PIN Lama -> PIN Baru -> Konfirmasi PIN)
 * 2. Modal Greeting Sambutan Selamat Datang
 */
export const PinLoginModals: React.FC<PinLoginModalsProps> = ({
  changePinModalVisible,
  onCloseChangePinModal,
  changePinStep,
  activeProfileName,
  changePinInput,
  changePinError,
  modalShake,
  onModalNumPress,
  onModalDeletePress,
  pinLength = 6,
  isSavingChangePin = false,
  welcomeVisible,
  welcomeCashierName,
  welcomeIsFirstTime = true,
  onWelcomeDismiss,
  styles: parentStyles,
}) => {
  const { theme, isDark } = useTheme();
  const s = parentStyles || makeStyles(theme, isDark);

  return (
    <>
      {/* MODAL GANTI PIN KASIR DENGAN STEP STATE MANDIRI */}
      <Modal
        visible={changePinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={onCloseChangePinModal}
      >
        <View style={s.modalOverlay}>
          <View style={s.changePinCard}>
            {/* Header Modal */}
            <View style={s.changePinHeader}>
              <View style={s.changePinTitleRow}>
                <View style={s.changePinIconWrap}>
                  <KeyRound size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.changePinTitle}>
                    {changePinStep === 'VERIFY_OLD'
                      ? 'Masukkan PIN Lama'
                      : changePinStep === 'ENTER_NEW'
                      ? 'Masukkan PIN Baru'
                      : 'Konfirmasi PIN Baru'}
                  </Text>
                  <Text style={s.changePinSubtitle} numberOfLines={1}>
                    {changePinStep === 'VERIFY_OLD'
                      ? `Verifikasi PIN saat ini untuk ${activeProfileName}`
                      : changePinStep === 'ENTER_NEW'
                      ? `Ketik ${pinLength} digit PIN pengganti untuk ${activeProfileName}`
                      : 'Ketik ulang PIN baru untuk mengonfirmasi'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onCloseChangePinModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Stepper Indikator Langkah */}
            <View style={s.stepperRow}>
              <View
                style={[
                  s.stepBadge,
                  changePinStep === 'VERIFY_OLD' && s.stepBadgeActive,
                  (changePinStep === 'ENTER_NEW' || changePinStep === 'CONFIRM_NEW') &&
                    s.stepBadgeCompleted,
                ]}
              >
                <Text
                  style={[
                    s.stepBadgeText,
                    (changePinStep === 'VERIFY_OLD' ||
                      changePinStep === 'ENTER_NEW' ||
                      changePinStep === 'CONFIRM_NEW') &&
                      s.stepBadgeTextActive,
                  ]}
                >
                  1. PIN Lama
                </Text>
              </View>

              <View
                style={[
                  s.stepBadge,
                  changePinStep === 'ENTER_NEW' && s.stepBadgeActive,
                  changePinStep === 'CONFIRM_NEW' && s.stepBadgeCompleted,
                ]}
              >
                <Text
                  style={[
                    s.stepBadgeText,
                    (changePinStep === 'ENTER_NEW' || changePinStep === 'CONFIRM_NEW') &&
                      s.stepBadgeTextActive,
                  ]}
                >
                  2. PIN Baru
                </Text>
              </View>

              <View
                style={[
                  s.stepBadge,
                  changePinStep === 'CONFIRM_NEW' && s.stepBadgeActive,
                ]}
              >
                <Text
                  style={[
                    s.stepBadgeText,
                    changePinStep === 'CONFIRM_NEW' && s.stepBadgeTextActive,
                  ]}
                >
                  3. Konfirmasi
                </Text>
              </View>
            </View>

            {/* Indikator Titik 6-Digit PIN */}
            <Animated.View
              style={[
                s.modalPinDotsContainer,
                modalShake ? { transform: [{ translateX: modalShake }] } : undefined,
              ]}
            >
              {Array.from({ length: pinLength }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.modalPinDot,
                    i < changePinInput.length && s.modalPinDotFilled,
                  ]}
                />
              ))}
            </Animated.View>

            {/* Pesan Error Modal */}
            {changePinError ? (
              <Text style={s.modalErrorText}>{changePinError}</Text>
            ) : null}

            {/* Numpad Mini Khusus Modal */}
            <View style={s.modalNumpad}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
              ].map((row, rIdx) => (
                <View key={rIdx} style={s.modalNumpadRow}>
                  {row.map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={s.modalNumBtn}
                      onPress={() => onModalNumPress(num)}
                      disabled={isSavingChangePin}
                      activeOpacity={0.65}
                    >
                      <Text style={s.modalNumBtnText}>{num}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              <View style={s.modalNumpadRow}>
                <TouchableOpacity
                  style={s.modalNumBtn}
                  onPress={onCloseChangePinModal}
                  disabled={isSavingChangePin}
                  activeOpacity={0.65}
                >
                  <Text
                    style={[
                      s.modalNumBtnText,
                      { fontSize: 13, color: theme.colors.textSecondary },
                    ]}
                  >
                    Batal
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.modalNumBtn}
                  onPress={() => onModalNumPress('0')}
                  disabled={isSavingChangePin}
                  activeOpacity={0.65}
                >
                  <Text style={s.modalNumBtnText}>0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.modalNumBtn}
                  onPress={onModalDeletePress}
                  disabled={isSavingChangePin || changePinInput.length === 0}
                  activeOpacity={0.65}
                >
                  <Delete size={20} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Greeting Selamat Datang */}
      {welcomeVisible !== undefined && onWelcomeDismiss ? (
        <WelcomeGreetingModal
          visible={welcomeVisible}
          cashierName={welcomeCashierName || 'Kasir'}
          isFirstTime={welcomeIsFirstTime}
          onDismiss={onWelcomeDismiss}
        />
      ) : null}
    </>
  );
};

export default PinLoginModals;
