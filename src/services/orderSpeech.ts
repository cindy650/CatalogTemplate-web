const pendingMessages: string[] = [];
const activationEvents = ['click', 'touchend', 'keydown'] as const;

let unlocked = false;
let activationListenerInstalled = false;

function speechSupported(): boolean {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';
}

function preferredVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase() === 'zh-cn')
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('zh'));
}

function createUtterance(text: string): SpeechSynthesisUtterance {
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 1;
  utterance.pitch = 1;
  const voice = preferredVoice();
  if (voice) utterance.voice = voice;
  return utterance;
}

function speak(text: string): void {
  const normalized = text.trim();
  if (!normalized || !speechSupported()) return;
  window.speechSynthesis.speak(createUtterance(normalized));
}

function removeActivationListeners(): void {
  for (const eventName of activationEvents) {
    document.removeEventListener(eventName, unlockSpeech, true);
  }
  activationListenerInstalled = false;
}

function unlockSpeech(): void {
  if (!speechSupported()) return;
  removeActivationListeners();
  window.speechSynthesis.resume();

  const unlockUtterance = createUtterance('\u00a0');
  unlockUtterance.volume = 0;
  window.speechSynthesis.speak(unlockUtterance);
  unlocked = true;

  pendingMessages.splice(0).forEach(speak);
}

/** Unlocks browser speech synthesis on the user's first interaction anywhere in the page. */
export function unlockOrderSpeechOnFirstUserActivation(): () => void {
  if (typeof document === 'undefined' || !speechSupported() || unlocked) {
    return () => undefined;
  }
  if (!activationListenerInstalled) {
    activationListenerInstalled = true;
    for (const eventName of activationEvents) {
      document.addEventListener(eventName, unlockSpeech, {
        capture: true,
        passive: true,
      });
    }
  }
  return removeActivationListeners;
}

export function speakOrderMessage(message: string): void {
  const normalized = message.trim();
  if (!normalized || !speechSupported()) return;
  if (!unlocked) {
    pendingMessages.push(normalized);
    if (pendingMessages.length > 10) pendingMessages.shift();
    return;
  }
  speak(normalized);
}
