const audioContext = new (window.AudioContext || window.webkitAudioContext)();

export const playSound = (type) => {
  try {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const sounds = {
      success: {
        frequency: 523.25,
        duration: 0.15,
        type: 'sine',
      },
      error: {
        frequency: 200,
        duration: 0.3,
        type: 'sawtooth',
      },
      delete: {
        frequency: 150,
        duration: 0.2,
        type: 'square',
      },
      update: {
        frequency: 440,
        duration: 0.1,
        type: 'sine',
      },
      notification: {
        frequency: 659.25,
        duration: 0.2,
        type: 'sine',
      },
    };

    const sound = sounds[type] || sounds.success;

    oscillator.type = sound.type;
    oscillator.frequency.setValueAtTime(sound.frequency, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + sound.duration);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

export const playSuccessSound = () => playSound('success');
export const playErrorSound = () => playSound('error');
export const playDeleteSound = () => playSound('delete');
export const playUpdateSound = () => playSound('update');
export const playNotificationSound = () => playSound('notification');
