<script setup lang="ts">
useHead({
  meta: [
    { name: 'theme-color', content: '#050505' },
  ],
})
</script>

<template>
  <div
    class="
      flex min-h-svh items-center justify-center bg-[#050505] p-4 font-mono
      md:p-8
    "
  >
    <main class="w-full">
      <slot />
    </main>
  </div>
</template>
