import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../constants/theme';
import { markOnboardingDone } from '../lib/storage';
import { RSVPWord } from '../components/RSVPWord';
import { splitWordAtORP } from '../lib/rsvp';

const { width } = Dimensions.get('window');

const DEMO_WORDS = [
  'Read', 'faster', 'than', 'ever', 'before', 'with', 'RSVP',
  'technology', 'that', 'trains', 'your', 'brain', 'to', 'process',
  'words', 'at', 'lightning', 'speed', 'effortlessly',
];

const SLIDES = [
  {
    id: 1,
    headline: 'Read 3× Faster',
    subhead: 'RSVP technology flashes words at your eyes one at a time. Your brain locks in, distractions drop out.',
    icon: 'flash',
    demo: 'rsvp',
  },
  {
    id: 2,
    headline: 'Track Your Progress',
    subhead: 'Every session logged. Watch your WPM climb. Hit new personal bests and unlock reading levels.',
    icon: 'trending-up',
    demo: 'chart',
  },
  {
    id: 3,
    headline: 'Start Reading Today',
    subhead: '3 free documents per day. Go Pro for unlimited reading, full library access, and cloud sync.',
    icon: 'rocket',
    demo: 'cta',
  },
];

export default function OnboardingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [demoWordIndex, setDemoWordIndex] = useState(0);

  // RSVP demo animation
  React.useEffect(() => {
    const interval = setInterval(() => {
      setDemoWordIndex((i) => (i + 1) % DEMO_WORDS.length);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const handleNext = async () => {
    if (currentSlide < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentSlide + 1) * width, animated: true });
      setCurrentSlide(currentSlide + 1);
    } else {
      await handleFinish();
    }
  };

  const handleSkip = async () => {
    await handleFinish();
  };

  const handleFinish = async () => {
    await markOnboardingDone();
    router.replace('/auth');
  };

  const currentWordParts = splitWordAtORP(DEMO_WORDS[demoWordIndex]);

  return (
    <View style={styles.container}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setCurrentSlide(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.id} style={[styles.slide, { width }]}>
            {/* Demo area */}
            <View style={styles.demoArea}>
              {slide.demo === 'rsvp' ? (
                <View style={styles.rsvpDemo}>
                  <RSVPWord parts={currentWordParts} fontSize={40} />
                  <Text style={styles.wpmIndicator}>300 WPM</Text>
                </View>
              ) : slide.demo === 'chart' ? (
                <View style={styles.chartDemo}>
                  <View style={styles.chartBars}>
                    {[120, 180, 210, 185, 240, 280, 310, 295, 340, 380].map((h, j) => (
                      <View
                        key={j}
                        style={[
                          styles.chartBar,
                          { height: h / 4, opacity: j === 9 ? 1 : 0.4 + j * 0.06 },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.chartLabel}>380 WPM — Personal Best</Text>
                </View>
              ) : (
                <View style={styles.ctaDemo}>
                  <Text style={styles.ctaPrice}>$9.99/mo</Text>
                  <Text style={styles.ctaPerks}>Unlimited · Cloud Sync · All Books</Text>
                </View>
              )}
            </View>

            {/* Text */}
            <View style={styles.textArea}>
              <Text style={styles.headline}>{slide.headline}</Text>
              <Text style={styles.subhead}>{slide.subhead}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom controls */}
      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentSlide && styles.dotActive]}
            />
          ))}
        </View>

        {/* Next / Get Started */}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextBtnText}>
            {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={currentSlide === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
            size={18}
            color={Colors.bg}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  skipBtn: {
    position: 'absolute',
    top: 60,
    right: Spacing.lg,
    zIndex: 10,
    padding: Spacing.sm,
  },
  skipText: {
    color: Colors.textMuted,
    fontSize: Typography.md,
  },
  slide: {
    flex: 1,
    paddingTop: 80,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  demoArea: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rsvpDemo: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  wpmIndicator: {
    color: Colors.gold,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  chartDemo: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 100,
  },
  chartBar: {
    width: 20,
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  chartLabel: {
    color: Colors.gold,
    fontSize: Typography.sm,
    fontWeight: Typography.semibold,
  },
  ctaDemo: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: `${Colors.gold}40`,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ctaPrice: {
    color: Colors.gold,
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
  },
  ctaPerks: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
  },
  textArea: {
    paddingBottom: 120,
    gap: Spacing.md,
    alignItems: 'center',
  },
  headline: {
    color: Colors.textPrimary,
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    textAlign: 'center',
  },
  subhead: {
    color: Colors.textMuted,
    fontSize: Typography.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.gold,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    gap: Spacing.sm,
  },
  nextBtnText: {
    color: Colors.bg,
    fontSize: Typography.md,
    fontWeight: Typography.bold,
  },
});
