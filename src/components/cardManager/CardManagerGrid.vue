<script setup>
import { useStore } from '@nanostores/vue';
import { cardListStore } from '../../lib/store/cardListStore.mjs';
import CardManagerCard from './CardManagerCard.vue';

const list = useStore(cardListStore);
</script>

<template>
  <div id="cardManagerList" class="card-manager-list" aria-live="polite">
    <p v-if="list.empty" class="card-manager-empty ui-empty-tip">暂无角色卡，点击右上角「新建」</p>
    <p v-else-if="list.filteredEmpty" class="card-manager-empty ui-empty-tip">没有符合筛选条件的角色卡</p>
    <template v-else>
      <CardManagerCard
        v-for="card in list.cards"
        :key="card.id"
        :card="card"
        :cloud-logged-in="!!list.cloudLoggedIn"
      />
    </template>
  </div>
</template>
