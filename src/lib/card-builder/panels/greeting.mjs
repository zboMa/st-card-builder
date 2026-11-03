import { createGreetingBridge } from './greetingBridge.mjs';

export function registerGreeting(ctx) {
  var bridge = createGreetingBridge(ctx);
  ctx.panels.greeting = {
    bind: bridge.bind,
    publish: bridge.publish,
  };
}
