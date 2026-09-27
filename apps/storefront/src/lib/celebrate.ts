import confetti from "canvas-confetti";

export function fireCheckoutCelebration() {
  const luxuryColors = ["#D4AF37", "#F5D77F", "#10B981", "#E2C974", "#FFFFFF", "#34D399"];

  // 1. Double corner fireworks cannon
  confetti({
    particleCount: 70,
    angle: 60,
    spread: 60,
    origin: { x: 0, y: 0.65 },
    colors: luxuryColors,
    zIndex: 99999,
  });

  confetti({
    particleCount: 70,
    angle: 120,
    spread: 60,
    origin: { x: 1, y: 0.65 },
    colors: luxuryColors,
    zIndex: 99999,
  });

  // 2. Center celebratory burst
  setTimeout(() => {
    confetti({
      particleCount: 100,
      spread: 120,
      origin: { x: 0.5, y: 0.4 },
      colors: luxuryColors,
      zIndex: 99999,
      scalar: 1.15,
      shapes: ["circle", "square"],
    });
  }, 250);

  // 3. Cascading golden sparkles
  setTimeout(() => {
    const end = Date.now() + 1500;
    const interval = setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }
      confetti({
        particleCount: 12,
        startVelocity: 25,
        spread: 360,
        ticks: 50,
        origin: { x: Math.random() * 0.8 + 0.1, y: Math.random() * 0.3 },
        colors: luxuryColors,
        zIndex: 99999,
        gravity: 0.9,
        scalar: 0.85,
      });
    }, 180);
  }, 500);
}
