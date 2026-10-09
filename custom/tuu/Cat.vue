<script setup lang="ts">
import { useDocumentVisibility, useIntervalFn, usePreferredReducedMotion } from '@vueuse/core'

// Cat batting ball animation frames (7 frames, 5 lines each)
const currentFrame = ref(0)

const B = '<span class="ball">●</span>'

const catFrames = [
  // Frame 0: Cat watching ball on the ground
  [
    '                         ',
    '    /\\_/\\              ',
    `   ( o.o )         ${B}   `,
    '    &gt; ^ &lt;               ',
    '    /| |\\              ',
  ].join('\n'),
  // Frame 1: Cat reaches paw toward ball
  [
    '                         ',
    '    /\\_/\\              ',
    `   ( o.o )&gt;--  ${B}       `,
    '    &gt; ^ &lt;               ',
    '    /| |\\              ',
  ].join('\n'),
  // Frame 2: Paw makes contact!
  [
    '                         ',
    '    /\\_/\\              ',
    `   ( &gt;w&lt; )&gt;--${B}         `,
    '    &gt; ^ &lt;               ',
    '    /| |\\              ',
  ].join('\n'),
  // Frame 3: Ball launches upward
  [
    '                         ',
    `    /\\_/\\       ${B}     `,
    '   ( ^.^ )/             ',
    '    &gt; ^ &lt;               ',
    '    /| |\\              ',
  ].join('\n'),
  // Frame 4: Ball at peak
  [
    `              ${B}         `,
    '    /\\_/\\              ',
    '   ( ^.^ )              ',
    '    &gt; ^ &lt;               ',
    '    /| |\\              ',
  ].join('\n'),
  // Frame 5: Ball falling
  [
    `                    ${B}   `,
    '    /\\_/\\              ',
    '   ( o.o )              ',
    '    &gt; ^ &lt;               ',
    '    /| |\\              ',
  ].join('\n'),
  // Frame 6: Ball bounces back to ground
  [
    '                         ',
    '    /\\_/\\              ',
    '   ( o.o )              ',
    `    &gt; ^ &lt;          ${B}   `,
    '    /| |\\              ',
  ].join('\n'),
]

const visibility = useDocumentVisibility()
const reducedMotion = usePreferredReducedMotion()
const { pause, resume } = useIntervalFn(() => {
  currentFrame.value = (currentFrame.value + 1) % catFrames.length
}, 500, { immediate: false })

watchEffect(() => {
  if (visibility.value === 'visible' && reducedMotion.value !== 'reduce')
    resume()
  else
    pause()
})
</script>

<template>
  <!-- The animation updates only this component, not the terminal or its input. -->
  <pre
    class="
      cat-art text-xs/snug text-[#8b949e]
      md:text-[13px]
    "
    aria-label="ASCII art of a cat batting a ball"
    v-html="catFrames[currentFrame]"
  />
</template>

<style scoped>
.cat-art :deep(.ball) {
  color: #f0a030;
  text-shadow:
    0 0 6px rgba(240, 160, 48, 0.5),
    0 0 14px rgba(240, 160, 48, 0.25);
}
</style>
