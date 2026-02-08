<script setup lang="ts">
import { Command, MousePointer2 } from 'lucide-vue-next'

const { description, github } = useAppConfig()
const { stats } = useGithubStats()

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

let animInterval: ReturnType<typeof setInterval> | undefined
const isTouchDevice = ref(false)
const isModifierPressed = ref(false)
const isSinkHovered = ref(false)

const showSinkModifierHint = computed(() =>
  !isTouchDevice.value && isSinkHovered.value && !isModifierPressed.value,
)

const sinkLinkStateClass = computed(() => {
  if (isTouchDevice.value)
    return 'cursor-pointer touch-manipulation hover:underline'

  if (isSinkHovered.value && isModifierPressed.value)
    return 'cursor-alias text-[#79c0ff] underline decoration-current decoration-solid'

  if (isSinkHovered.value)
    return 'cursor-help text-[#79c0ff]/90 underline decoration-current decoration-dotted'

  return 'cursor-help'
})

function trackModifierKey(event: KeyboardEvent) {
  isModifierPressed.value = event.metaKey || event.ctrlKey
}

function resetModifierKey() {
  isModifierPressed.value = false
}

onMounted(() => {
  isTouchDevice.value = window.matchMedia('(hover: none), (pointer: coarse)').matches
  window.addEventListener('keydown', trackModifierKey)
  window.addEventListener('keyup', trackModifierKey)
  window.addEventListener('blur', resetModifierKey)

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!prefersReducedMotion) {
    animInterval = setInterval(() => {
      currentFrame.value = (currentFrame.value + 1) % catFrames.length
    }, 500)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', trackModifierKey)
  window.removeEventListener('keyup', trackModifierKey)
  window.removeEventListener('blur', resetModifierKey)

  if (animInterval)
    clearInterval(animInterval)
})

// Interactive terminal input
interface CommandEntry {
  id: number
  command: string
  output?: string
  isError?: boolean
}

const commandInput = ref('')
const commandHistory = ref<CommandEntry[]>([])
const inputRef = ref<HTMLInputElement | null>(null)
const isFocused = ref(false)

function handleSinkRepoClick(event: MouseEvent) {
  // Keep terminal-like behavior on desktop: require modifier click to follow links.
  if (!isTouchDevice.value) {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      window.open(github, '_blank', 'noopener,noreferrer')
      return
    }

    event.preventDefault()
  }
}

function focusInput() {
  inputRef.value?.focus()
}

function handleCommand() {
  const raw = commandInput.value.trim()
  if (!raw)
    return

  const cmd = raw.toLowerCase()

  // sudo → grant access to dashboard
  if (cmd.startsWith('sudo')) {
    navigateTo('/dashboard')
    return
  }

  let output = ''
  let isError = true

  if (cmd === 'cd /dashboard' || cmd === 'cd /dashboard/') {
    output = 'bash: cd: /dashboard: Permission denied'
  }
  else if (cmd === 'open github') {
    window.open(github, '_blank')
    isError = false
  }
  else if (cmd === 'clear') {
    commandHistory.value = []
    commandInput.value = ''
    return
  }
  else if (cmd === 'cat') {
    output = 'meow~'
    isError = false
  }
  else if (cmd === 'help') {
    output = 'try: sudo, cd /dashboard, open github, cat, clear'
    isError = false
  }
  else {
    output = `bash: ${raw.split(' ')[0]}: command not found`
  }

  commandHistory.value.push({
    id: Date.now(),
    command: raw,
    output,
    isError,
  })

  // Keep only last 3 entries to prevent overflow
  if (commandHistory.value.length > 3) {
    commandHistory.value = commandHistory.value.slice(-3)
  }

  commandInput.value = ''
}
</script>

<template>
  <section class="mx-auto w-full max-w-2xl">
    <!-- Terminal Window -->
    <div class="terminal overflow-hidden rounded-xl border border-white/[0.06]">
      <!-- macOS Title Bar -->
      <div
        class="
          flex items-center border-b border-white/[0.06] bg-[#1e1e1e] px-4 py-3
        "
      >
        <div class="flex gap-2">
          <span class="size-3 rounded-full bg-[#ff5f57]" />
          <span class="size-3 rounded-full bg-[#febc2e]" />
          <span class="size-3 rounded-full bg-[#28c840]" />
        </div>
        <span class="flex-1 text-center text-xs text-white/25">tuu@cat:~ — zsh</span>
        <div class="w-[52px]" />
      </div>

      <!-- Terminal Body -->
      <div
        class="
          space-y-5 bg-[#0c0c0c] px-5 py-6 text-[13px] leading-relaxed
          text-[#d4d4d4]
          md:px-8 md:text-sm
        "
        @click="focusInput"
      >
        <!-- Command: sink -->
        <div>
          <p>
            <span class="text-[#3fb950]">$</span> sink
          </p>
          <p class="mt-0.5 text-[#58a6ff]">
            tuu.cat is a URL shortener built from
            <a
              :href="github"
              class="
                decoration-[1.5px] underline-offset-2 transition-colors
                duration-150
                focus-visible:rounded-[2px] focus-visible:ring-1
                focus-visible:ring-[#58a6ff] focus-visible:outline-none
              "
              :class="sinkLinkStateClass"
              rel="noopener noreferrer"
              @mouseenter="isSinkHovered = true"
              @mouseleave="isSinkHovered = false"
              @focus="isSinkHovered = true"
              @blur="isSinkHovered = false"
              @click="handleSinkRepoClick"
            >Sink</a><span
              v-if="showSinkModifierHint"
              class="
                ml-1.5 inline-flex items-center gap-1 align-middle
                text-[#8b949e]
              "
            >
              <Command class="size-3.5" aria-hidden="true" />
              <span class="text-[10px] leading-none" aria-hidden="true">+</span>
              <MousePointer2 class="size-3.5" aria-hidden="true" />
              <span class="sr-only">Hold Command or Control and click to open in a new tab</span>
            </span>.
          </p>
        </div>

        <!-- ASCII Cat Animation -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <pre
          class="
            cat-art text-xs leading-snug text-[#8b949e]
            md:text-[13px]
          "
          aria-label="ASCII art of a cat batting a ball"
          v-html="catFrames[currentFrame]"
        />

        <!-- Description -->
        <p class="text-[13px] text-[#6e7681]">
          {{ description }}
        </p>

        <!-- Stats -->
        <div>
          <p>
            <span class="text-[#3fb950]">$</span> sink --stats
          </p>
          <p class="mt-1 text-[#6e7681]">
            <ClientOnly>
              <template #fallback>
                <span>loading...</span>
              </template>
              <span>★ {{ stats.stars }} stars · ⑂ {{ stats.forks }} forks</span>
            </ClientOnly>
          </p>
        </div>

        <!-- GitHub link -->
        <a
          :href="github"
          target="_blank"
          rel="noopener noreferrer"
          class="
            block text-[#d4d4d4] transition-colors
            hover:text-[#58a6ff]
          "
        >
          <span class="text-[#3fb950]">$</span> open github
        </a>

        <!-- Static: cd /dashboard → Permission denied -->
        <div>
          <p>
            <span class="text-[#3fb950]">$</span> cd /dashboard
          </p>
          <p class="text-[#f85149]">
            bash: cd: /dashboard: Permission denied
          </p>
        </div>

        <!-- Dynamic Command History -->
        <div v-for="entry in commandHistory" :key="entry.id">
          <p>
            <span class="text-[#3fb950]">tuu@cat:~$</span> {{ entry.command }}
          </p>
          <p
            v-if="entry.output" :class="entry.isError ? 'text-[#f85149]' : `
              text-[#6e7681]
            `"
          >
            {{ entry.output }}
          </p>
        </div>

        <!-- Interactive Input Line -->
        <div class="flex items-center" @click.stop="focusInput">
          <span class="shrink-0 text-[#3fb950]">tuu@cat:~$</span>
          <div class="relative ml-1 flex-1">
            <input
              ref="inputRef"
              v-model="commandInput"
              class="
                terminal-input w-full bg-transparent text-[#d4d4d4] outline-none
              "
              type="text"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              @focus="isFocused = true"
              @blur="isFocused = false"
              @keydown.enter="handleCommand"
            >
            <span
              v-if="!isFocused && !commandInput"
              class="
                cursor-block pointer-events-none absolute top-1/2 left-0
                -translate-y-1/2
              "
            >&nbsp;</span>
          </div>
        </div>
      </div>

      <!-- Terminal Footer Credit -->
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
</template>

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

.terminal-input {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  caret-color: #d4d4d4;
}

.cat-art :deep(.ball) {
  color: #f0a030;
  text-shadow:
    0 0 6px rgba(240, 160, 48, 0.5),
    0 0 14px rgba(240, 160, 48, 0.25);
}

@media (prefers-reduced-motion: reduce) {
  .terminal {
    animation: none;
  }
  .cursor-block {
    animation: none;
  }
}
</style>
