<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap' },
  ],
  meta: [
    { name: 'theme-color', content: '#050505' },
  ],
})

const statusCode = computed(() => props.error?.statusCode ?? 404)

// ASCII "404" in block letters — 3 frames for flicker effect
const asciiFrames = [
  // Frame 0: Stable
  [
    ' ██╗  ██╗ ██████╗ ██╗  ██╗',
    ' ██║  ██║██╔═══██╗██║  ██║',
    ' ███████║██║   ██║███████║',
    ' ╚════██║██║   ██║╚════██║',
    '      ██║╚██████╔╝     ██║',
    '      ╚═╝ ╚═════╝      ╚═╝',
  ].join('\n'),
  // Frame 1: Glitch — horizontal shift on middle rows
  [
    ' ██╗  ██╗ ██████╗ ██╗  ██╗',
    ' ██║  ██║██╔═══██╗██║  ██║',
    '  ███████║██║  ██║███████║',
    ' ╚════██║██║   ██║╚════██║',
    '      ██║╚██████╔╝     ██║',
    '      ╚═╝ ╚═════╝      ╚═╝',
  ].join('\n'),
  // Frame 2: Partial blackout — blocks degraded to ░
  [
    ' ░░╗  ░░╗ ░░████╗ ░░╗  ░░╗',
    ' ░░║  ░░║░░╔═══██╗░░║  ░░║',
    ' ░░░████║░░║   ██║░░░████║',
    ' ╚════░░║░░║   ██║╚════░░║',
    '      ░░║╚░░████╔╝     ░░║',
    '      ╚═╝ ╚═════╝      ╚═╝',
  ].join('\n'),
]

const currentFrame = ref(0)
const flickerClass = ref('')

let animationTimer: ReturnType<typeof setTimeout> | undefined

function scheduleFlicker() {
  // Random delay: mostly stable (1.5-4s), occasional rapid bursts
  const isBurst = Math.random() < 0.3
  const delay = isBurst
    ? 50 + Math.random() * 150
    : 1500 + Math.random() * 2500

  animationTimer = setTimeout(() => {
    const roll = Math.random()
    if (roll < 0.4) {
      flickerClass.value = 'flicker-dim'
      currentFrame.value = 1
    }
    else if (roll < 0.7) {
      flickerClass.value = 'flicker-dark'
      currentFrame.value = 2
    }
    else {
      flickerClass.value = 'flicker-off'
      currentFrame.value = 2
    }

    const recovery = 60 + Math.random() * 140
    setTimeout(() => {
      flickerClass.value = ''
      currentFrame.value = 0
      scheduleFlicker()
    }, recovery)
  }, delay)
}

onMounted(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!prefersReducedMotion) {
    scheduleFlicker()
  }
})

onUnmounted(() => {
  if (animationTimer)
    clearTimeout(animationTimer)
})

function handleBack() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div
    class="
      flex min-h-svh items-center justify-center bg-[#050505] p-4
      md:p-8
    "
    style="font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
  >
    <main class="w-full">
      <section class="mx-auto w-full max-w-2xl">
        <!-- Terminal Window -->
        <div
          class="terminal overflow-hidden rounded-xl border border-white/[0.06]"
        >
          <!-- macOS Title Bar -->
          <div
            class="
              flex items-center border-b border-white/[0.06] bg-[#1e1e1e] px-4
              py-3
            "
          >
            <div class="flex gap-2">
              <span class="size-3 rounded-full bg-[#ff5f57]" />
              <span class="size-3 rounded-full bg-[#febc2e]" />
              <span class="size-3 rounded-full bg-[#28c840]" />
            </div>
            <span class="flex-1 text-center text-xs text-white/25">sink — error</span>
            <div class="w-[52px]" />
          </div>

          <!-- Terminal Body -->
          <div
            class="
              space-y-5 bg-[#0c0c0c] px-5 py-6 text-[13px] leading-relaxed
              text-[#d4d4d4]
              md:px-8 md:text-sm
            "
          >
            <!-- Command -->
            <p>
              <span class="text-[#f97583]">$</span> sink --resolve <span
                class="text-[#6e7681]"
              >...</span>
            </p>

            <!-- ASCII ERROR with Neon Glow -->
            <div class="neon-container overflow-x-auto" :class="flickerClass">
              <pre
                class="
                  neon-text text-xs leading-snug
                  md:text-[13px]
                "
                :aria-label="`ASCII art showing error ${statusCode}`"
              >{{ asciiFrames[currentFrame] }}</pre>
            </div>

            <!-- Error Message -->
            <div>
              <p>
                <span class="text-[#f97583]">error</span><span
                  class="text-[#6e7681]"
                >:</span>
                <span class="neon-text-subtle">
                  {{ error?.statusMessage || (statusCode === 404 ? 'page not found' : 'something went wrong') }}
                </span>
              </p>
              <p class="mt-1 text-[#6e7681]">
                the requested route could not be resolved.
              </p>
            </div>

            <!-- Diagnostic -->
            <div>
              <p>
                <span class="text-[#f97583]">$</span> sink --diagnose
              </p>
              <p class="mt-1 text-[#6e7681]">
                <span class="text-[#f97583]">[ERROR]</span> no matching route found
              </p>
              <p class="text-[#6e7681]">
                <span class="text-[#3fb950]">[tip]</span> check the url or return to safety
              </p>
            </div>

            <!-- Action Command -->
            <div>
              <a
                href="/"
                class="
                  block text-[#d4d4d4] transition-colors
                  hover:text-[#58a6ff]
                "
                @click.prevent="handleBack"
              >
                <span class="text-[#3fb950]">$</span> cd /home
              </a>
            </div>

            <!-- Blinking Cursor -->
            <p>
              <span class="text-[#f97583]">$</span>
              <span class="cursor-block ml-1">&nbsp;</span>
            </p>
          </div>

          <!-- Terminal Footer -->
          <div
            class="
              border-t border-white/[0.04] bg-[#0c0c0c] px-5 py-2 text-[11px]
              text-white/15
              md:px-8
            "
          >
            &copy; {{ new Date().getFullYear() }}
            <a
              href="https://html.zone"
              target="_blank"
              rel="noopener noreferrer"
              class="
                transition-colors
                hover:text-white/30
              "
            >
              Products of HTML.ZONE
            </a>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
</style>

<style scoped>
@keyframes terminal-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes neon-pulse {
  0%,
  100% {
    text-shadow:
      0 0 4px #f97583,
      0 0 11px #f9758380,
      0 0 19px #f9758340;
  }
  50% {
    text-shadow:
      0 0 2px #f97583,
      0 0 8px #f9758360,
      0 0 14px #f9758320;
  }
}

.terminal {
  animation: fade-slide-in 0.5s ease-out;
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.6);
}

.cursor-block {
  display: inline-block;
  width: 8px;
  background: #d4d4d4;
  animation: terminal-blink 1.06s step-end infinite;
}

/* Neon glow on the ASCII art */
.neon-text {
  color: #f97583;
  text-shadow:
    0 0 4px #f97583,
    0 0 11px #f9758380,
    0 0 19px #f9758340,
    0 0 40px #f9758318;
  animation: neon-pulse 3s ease-in-out infinite;
  transition:
    opacity 0.06s,
    text-shadow 0.06s,
    color 0.06s;
}

.neon-text-subtle {
  color: #f97583;
  text-shadow:
    0 0 4px #f9758360,
    0 0 8px #f9758330;
}

/* Neon flicker states — controlled via JS */
.neon-container {
  transition:
    opacity 0.04s,
    filter 0.04s;
}

.flicker-dim .neon-text {
  opacity: 0.5;
  text-shadow:
    0 0 2px #f9758350,
    0 0 6px #f9758320;
}

.flicker-dark .neon-text {
  opacity: 0.15;
  text-shadow: 0 0 1px #f9758320;
  color: #f9758340;
}

.flicker-off .neon-text {
  opacity: 0.03;
  text-shadow: none;
  color: #f9758310;
}

@media (prefers-reduced-motion: reduce) {
  .terminal {
    animation: none;
  }
  .cursor-block {
    animation: none;
  }
  .neon-text {
    animation: none;
  }
}
</style>
