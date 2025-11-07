import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import Constants from 'expo-constants';

export type SpeechResultHandler = (transcript: string, isFinal: boolean) => void;

type RecognitionInstance = {
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => any;

type VoiceModule = {
  onSpeechResults?: ((event: { value?: string[] }) => void) | null;
  onSpeechPartialResults?: ((event: { value?: string[] }) => void) | null;
  onSpeechError?: ((event: { error: { message?: string } }) => void) | null;
  onSpeechEnd?: (() => void) | null;
  start: (locale?: string) => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  destroy: () => Promise<void>;
  removeAllListeners: () => void;
};

export function useSpeechRecognition(onResult: SpeechResultHandler) {
  const lastFinalTranscriptRef = useRef('');
  const permissionGrantedRef = useRef(Platform.OS === 'android' ? false : true);
  const pendingFinalTranscriptRef = useRef('');
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  const requestAndroidPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    if (permissionGrantedRef.current) {
      return true;
    }

    try {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );

      if (alreadyGranted) {
        permissionGrantedRef.current = true;
        return true;
      }

      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone access required',
          message: 'PocketPilot needs microphone permission to capture voice commands.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );

      const granted = status === PermissionsAndroid.RESULTS.GRANTED;
      permissionGrantedRef.current = granted;

      if (!granted) {
        Alert.alert(
          'Speech input',
          'Microphone permission is required to use voice input. Enable it in system settings to continue.',
        );
      }

      return granted;
    } catch (error) {
      console.warn('Unable to request microphone permission', error);
      return false;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const locale =
        typeof globalThis !== 'undefined' && (globalThis as any)?.navigator?.language
          ? (globalThis as any).navigator.language
          : 'en-US';
      if (typeof window === 'undefined') {
        return;
      }

      const SpeechRecognition: SpeechRecognitionConstructor | undefined =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setSupported(false);
        return;
      }

      try {
        const recognition = new (SpeechRecognition as any)();
        recognition.lang = locale;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          if (!event.results.length) return;
          const transcript = Array.from(event.results)
            .slice(event.resultIndex)
            .map((result) => result[0]?.transcript ?? '')
            .join(' ')
            .trim();
          const isFinal = event.results[event.results.length - 1]?.isFinal ?? false;
          if (transcript) {
            if (isFinal) {
              pendingFinalTranscriptRef.current = transcript;
            } else {
              pendingFinalTranscriptRef.current = '';
            }
            onResult(transcript, false);
          }
        };

        recognition.onerror = (event: any) => {
          if (event?.error === 'not-allowed') {
            Alert.alert(
              'Speech input',
              'Microphone access was denied. Enable microphone permissions for this site to use voice input.',
            );
          }
          setListening(false);
        };

        recognition.onend = () => {
          const finalTranscript = pendingFinalTranscriptRef.current.trim();
          if (finalTranscript.length) {
            if (lastFinalTranscriptRef.current !== finalTranscript) {
              lastFinalTranscriptRef.current = finalTranscript;
              onResult(finalTranscript, true);
            }
          }
          pendingFinalTranscriptRef.current = '';
          setListening(false);
        };

        recognition.onstart = () => {
          lastFinalTranscriptRef.current = '';
          pendingFinalTranscriptRef.current = '';
          setListening(true);
        };

        recognitionRef.current = recognition as unknown as RecognitionInstance;
        setSupported(true);
      } catch (error) {
        console.warn('Speech recognition unavailable', error);
        setSupported(false);
      }

      return () => {
        recognitionRef.current?.stop?.();
      };
    }

    // Native platforms
    const isExpoGo = Constants?.appOwnership === 'expo';
    if (isExpoGo) {
      console.warn('Speech recognition unavailable in Expo Go. Use a development build to enable native voice input.');
      setSupported(false);
      return;
    }

    let Voice: VoiceModule | null = null;
    try {
      const voiceImport = require('@react-native-voice/voice');
      Voice = voiceImport?.default ?? voiceImport;
    } catch (error) {
      console.warn('Native speech recognition module not found. Install `@react-native-voice/voice` to enable voice input.', error);
      setSupported(false);
      return;
    }

    if (!Voice) {
      setSupported(false);
      return;
    }

    const locale = (globalThis as any)?.navigator?.language ?? 'en-US';

    Voice.onSpeechResults = (event) => {
      const transcript = event?.value?.join(' ').trim();
      if (transcript) {
        if (lastFinalTranscriptRef.current === transcript) {
          return;
        }
        lastFinalTranscriptRef.current = transcript;
        onResult(transcript, true);
      }
    };

    Voice.onSpeechPartialResults = (event) => {
      const transcript = event?.value?.join(' ').trim();
      if (transcript) {
        onResult(transcript, false);
      }
    };

    Voice.onSpeechError = (event) => {
      const message = event?.error?.message;
      if (message) {
        console.warn('Speech recognition error:', message);
      }
      const lowered = message?.toLowerCase();
      if (lowered?.includes('perm')) {
        permissionGrantedRef.current = false;
      }
      setListening(false);
    };

    Voice.onSpeechEnd = () => {
      setListening(false);
    };

    recognitionRef.current = {
      start: async () => {
        try {
          if (Platform.OS === 'android') {
            const permitted = await requestAndroidPermission();
            if (!permitted) {
              return;
            }
          } else if (Platform.OS === 'ios') {
            try {
              const micStatus = await Voice?.requestMicrophonePermission?.();
              const speechStatus = await Voice?.requestSpeechRecognitionPermission?.();
              const micGranted = micStatus === 'granted' || micStatus === 'authorized';
              const speechGranted = speechStatus === 'granted' || speechStatus === 'authorized';
              if (!micGranted || !speechGranted) {
                Alert.alert(
                  'Speech input',
                  'Enable microphone and speech recognition access in Settings to continue using voice commands.',
                );
                return;
              }
            } catch (error) {
              console.warn('Failed to confirm iOS speech permissions', error);
              return;
            }
          }
          lastFinalTranscriptRef.current = '';
          pendingFinalTranscriptRef.current = '';
          const result = Voice?.start?.(locale);
          setListening(true);
          if (result && typeof result.then === 'function') {
            result.catch((error: any) => {
              console.warn('Failed to start voice recognition', error);
              setListening(false);
            });
          }
        } catch (error) {
          console.warn('Failed to start voice recognition', error);
          setListening(false);
        }
      },
      stop: () => {
        try {
          const result = Voice?.stop?.();
          setListening(false);
          if (result && typeof result.then === 'function') {
            result.catch((error: any) => console.warn('Failed to stop voice recognition', error));
          }
        } catch (error) {
          console.warn('Failed to stop voice recognition', error);
        }
      },
      abort: () => {
        try {
          const result = Voice?.cancel?.();
          setListening(false);
          if (result && typeof result.then === 'function') {
            result.catch((error: any) => console.warn('Failed to cancel voice recognition', error));
          }
        } catch (error) {
          console.warn('Failed to cancel voice recognition', error);
        }
      },
    };

    setSupported(true);

    return () => {
      try {
        Voice?.destroy?.();
        Voice?.removeAllListeners?.();
      } catch (error) {
        console.warn('Failed to clean up voice recognition', error);
      }
    };
  }, [onResult, requestAndroidPermission]);

  const start = useCallback(() => {
    if (!supported || !recognitionRef.current) {
      const message =
        Platform.OS === 'web'
          ? 'Speech recognition is not supported in this browser.'
          : 'Speech recognition requires installing `@react-native-voice/voice` and microphone permissions.';
      Alert.alert('Speech input', message);
      return;
    }
    try {
      recognitionRef.current.abort?.();
      recognitionRef.current.start();
    } catch (error) {
      console.warn('Failed to start speech recognition', error);
    }
  }, [supported]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
