export const easeOut = [0.16, 1, 0.3, 1] as const;

export const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.7, ease: easeOut },
  },
};

export const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

export const viewportOnce = {
  once: true as const,
  amount: 0.15 as const,
  margin: "-60px" as const,
};
