<script setup lang="ts">
useHead({
  link: [
    { rel: 'preload', href: '/tuu/fonts/JetBrainsMono-latin.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
  ],
  meta: [
    { name: 'theme-color', content: '#050505' },
  ],
})
</script>

<template>
  <div
    class="
      tuu-terminal flex min-h-svh items-center justify-center bg-[#050505] p-4
      md:p-8
    "
  >
    <main class="w-full">
      <slot />
    </main>
  </div>
</template>
