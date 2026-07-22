/**
 * 小说工坊：角色设定/开场白事件绑定（拆自 browserApp）
 */
export function attachNovelBootEvents(deps) {
  if (deps.bindCharacterSetup) deps.bindCharacterSetup();
  if (deps.bindGreetingsGen) deps.bindGreetingsGen();
}
